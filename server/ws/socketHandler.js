/**
 * socketHandler.js — Manejo de conexiones WebSocket de los agentes (v2).
 *
 * CAMBIOS RESPECTO A v1:
 *  • Autenticación por agente: cada agente tiene su propio secret en agents.json
 *    (ya no hay un secret global compartido).
 *  • Action Manifest: cuando el agente se autentica, envía la lista de acciones
 *    que soporta. El servidor las guarda en el registry para poder validar
 *    ANTES de reenviar una petición.
 *
 * FLUJO:
 *  1. El agente se conecta y envía { type: 'auth', clienteId, secret, actions: [...] }
 *  2. El servidor valida el secret contra agents.json (por agente, no global)
 *  3. Guarda al agente + sus acciones en el registry
 *  4. Cuando el servidor envía { type: 'query', action, params }, el agente resuelve el SQL
 *  5. El agente responde con { type: 'queryResult', correlationId, data/error }
 *  6. El servidor resuelve la promesa HTTP pendiente
 */

const path = require('path');
const registry = require('../lib/registry');

// ─── Cargar registro de agentes autorizados ──────────────────────────────────
// Cada agente tiene su propio secret único. Si se compromete uno, los demás
// siguen seguros (a diferencia del secret global de v1).
let AGENTS_CONFIG;
try {
  AGENTS_CONFIG = require(path.resolve(__dirname, '../agents.json'));
  // Eliminamos el campo de comentario si existe
  delete AGENTS_CONFIG['_comentario'];
  console.log(`[WS] Registro de agentes cargado: ${Object.keys(AGENTS_CONFIG).length} agentes autorizados.`);
} catch (err) {
  console.error('[WS] FATAL: No se pudo leer agents.json. Sin este archivo, ningún agente puede conectarse.', err.message);
  console.error('[WS] Copia agents.json.example como agents.json y configura los secrets.');
  process.exit(1);
}

// ─── Configuración de tiempos ────────────────────────────────────────────────

// Tiempo máximo para autenticarse después de conectar (10 segundos).
// Si un agente se conecta y no envía credenciales en este tiempo, se le cierra la conexión.
const AUTH_TIMEOUT_MS = 10_000;

// Intervalo de heartbeat/ping (30 segundos) para detectar si un agente se ha
// desconectado por un fallo de red sin avisar (zombie connection).
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Inicializa el handler del WebSocket Server.
 * Se llama una sola vez desde index.js al arrancar el servidor.
 *
 * @param {import('ws').WebSocketServer} wss - Instancia del servidor WebSocket
 */
function initSocketHandler(wss) {
  // Cada vez que un agente establece una nueva conexión TCP/WebSocket:
  wss.on('connection', (ws, req) => {
    const remoteAddr = req.socket.remoteAddress;
    console.log(`[WS] Nueva conexión desde ${remoteAddr}`);

    // ── Estado de la conexión de este agente específico ──
    let clienteId = null;        // Se llenará cuando se autentique
    let isAuthenticated = false;  // Bandera de seguridad
    let isAlive = true;           // Usado para el heartbeat (saber si sigue vivo)

    // ── Timeout de autenticación ──
    // Iniciamos un contador. Si a los 10 segundos no está autenticado, lo cerramos.
    const authTimer = setTimeout(() => {
      if (!isAuthenticated) {
        console.warn(`[WS] Conexión desde ${remoteAddr} no se autenticó a tiempo. Cerrando.`);
        ws.close(4000, 'Auth timeout');
      }
    }, AUTH_TIMEOUT_MS);

    // ── Heartbeat (ping/pong) ──
    // Cada 30 segundos verificamos si el agente respondió al ping anterior.
    const pingInterval = setInterval(() => {
      if (!isAlive) {
        // Si no respondió (isAlive es false), el agente está caído o la red se cortó
        console.warn(`[WS] Agente "${clienteId || 'sin-auth'}" no respondió al ping. Cerrando.`);
        ws.terminate(); // Cerramos forzosamente
        return;
      }
      isAlive = false; // Marcamos como falso y enviamos un nuevo ping
      ws.ping();       // El evento 'pong' (abajo) lo volverá a poner en true
    }, HEARTBEAT_INTERVAL_MS);

    // Cuando el agente responde al ping nativo del protocolo WebSocket:
    ws.on('pong', () => {
      isAlive = true;
    });

    // ── Manejo de mensajes entrantes (lo que envía el Agente) ──
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString()); // Todo se comunica en JSON
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'JSON inválido' }));
        return;
      }

      // Procesamos según el tipo de mensaje
      switch (msg.type) {
        // ─── Autenticación (Primer mensaje obligatorio) ──────────────
        case 'auth': {
          if (isAuthenticated) return; // Si ya está autenticado, ignorar

          // Verificamos que traiga las variables necesarias
          if (!msg.clienteId || !msg.secret) {
            ws.send(JSON.stringify({
              type: 'authResult',
              success: false,
              message: 'Faltan campos clienteId o secret',
            }));
            ws.close(4002, 'Auth incompleta');
            return;
          }

          // ── NUEVA VALIDACIÓN: Secret por agente ──
          // Buscamos el agente en agents.json por su clienteId
          const agentConfig = AGENTS_CONFIG[msg.clienteId];

          if (!agentConfig) {
            // El clienteId no está registrado en agents.json
            console.warn(`[WS] ClienteId "${msg.clienteId}" no registrado en agents.json. Desde ${remoteAddr}`);
            ws.send(JSON.stringify({
              type: 'authResult',
              success: false,
              message: `ClienteId "${msg.clienteId}" no está autorizado en este servidor.`,
            }));
            ws.close(4003, 'ClienteId no autorizado');
            return;
          }

          // Verificamos que el secret coincida con el de ESE agente específico
          if (msg.secret !== agentConfig.secret) {
            console.warn(`[WS] Secret inválido para "${msg.clienteId}" desde ${remoteAddr}`);
            ws.send(JSON.stringify({
              type: 'authResult',
              success: false,
              message: 'Secret inválido para este agente.',
            }));
            ws.close(4003, 'Secret inválido');
            return;
          }

          // ── Autenticación exitosa ──
          clienteId = msg.clienteId;
          isAuthenticated = true;
          clearTimeout(authTimer); // Ya no lo cerramos por timeout de auth

          // ── NUEVO: Action Manifest ──
          // El agente envía la lista de acciones que soporta.
          // Las guardamos en el registry para poder validar antes de reenviar.
          const actions = Array.isArray(msg.actions) ? msg.actions : [];

          // Lo guardamos en el registry para que la API REST pueda encontrarlo
          registry.registerAgent(clienteId, ws, actions);

          // Le avisamos al agente que todo salió bien
          ws.send(JSON.stringify({
            type: 'authResult',
            success: true,
            message: `Bienvenido, agente "${clienteId}". ${actions.length} acciones registradas.`,
          }));
          console.log(`[WS] Agente "${clienteId}" autenticado desde ${remoteAddr} (${actions.length} acciones)`);
          break;
        }

        // ─── Resultado de una query ──────────────────────────────────
        // Esto llega después de que el servidor (vía la API) envió un { type: 'query' } al agente
        case 'queryResult': {
          if (!isAuthenticated) {
            ws.send(JSON.stringify({ type: 'error', message: 'No autenticado' }));
            return;
          }

          const { correlationId, data, error } = msg;

          // Necesitamos el UUID para saber a qué petición HTTP pertenece esta respuesta
          if (!correlationId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Falta correlationId en queryResult' }));
            return;
          }

          // Resuelve o rechaza la promesa que está "pausada" en api.js
          const resolved = registry.resolvePending(correlationId, error || data, !!error);
          if (!resolved) {
            // Si la promesa ya no existe, probablemente venció el timeout de 30s
            console.warn(`[WS] correlationId "${correlationId}" no encontrado (timeout o duplicado)`);
          }
          break;
        }

        // ─── Pong del agente (heartbeat de capa aplicación) ──────────
        // Fallback manual para clientes WebSocket que no soportan el ping nativo
        case 'pong': {
          isAlive = true;
          break;
        }

        // ─── Tipo desconocido ────────────────────────────────────────
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Tipo de mensaje desconocido: "${msg.type}"`,
          }));
      }
    });

    // ── Desconexión: Limpieza cuando el socket se cierra ──
    ws.on('close', (code, reason) => {
      clearTimeout(authTimer);   // Limpiamos temporizadores
      clearInterval(pingInterval);
      if (clienteId) {
        // Lo sacamos del registry para que la API no intente mandarle queries
        registry.unregisterAgent(clienteId, ws);
        console.log(`[WS] Agente "${clienteId}" desconectado (code: ${code}, reason: ${reason})`);
      }
    });

    // ── Manejo de errores a nivel de socket ──
    ws.on('error', (err) => {
      console.error(`[WS] Error en conexión ${clienteId || remoteAddr}:`, err.message);
    });
  });

  console.log('[WS] Socket handler inicializado (autenticación por agente + action manifest)');
}

module.exports = { initSocketHandler };
