/**
 * gdata-tunnel-agent v2 — Cliente on-premise del Túnel Inverso.
 *
 * ARQUITECTURA:
 *   Este script se ejecuta en la red interna del cliente (donde está la base de datos).
 *   Se conecta de forma "Outbound" al servidor central por WebSocket,
 *   así no hay que abrir puertos en el router del cliente.
 *
 * MEJORAS RESPECTO A v1:
 *   • QUERIES LOCALES: El agente tiene su propio queries.json con todas las
 *     consultas permitidas. El servidor solo envía nombres de acción, no SQL.
 *   • ACTION MANIFEST: Al autenticarse, el agente envía la lista de sus acciones
 *     al servidor para validación temprana.
 *   • MULTI-MOTOR DE BD: Soporta SQL Server, PostgreSQL y MySQL.
 *   • MODO SOLO-LECTURA: Si "readOnly" es true en config.json, cualquier query
 *     que intente escribir es rechazada automáticamente.
 *   • AUDITORÍA: Cada acción ejecutada se registra en archivos de log diarios.
 *   • TIPOS DE PARÁMETROS: Los parámetros se validan por tipo antes de ejecutar.
 *
 * FLUJO DEL AGENTE:
 *   1. Lee config.json para saber a dónde conectarse y con qué base de datos.
 *   2. Carga queries.json (lista blanca de acciones permitidas).
 *   3. Inicia conexión WS al servidor central y se autentica (enviando su action manifest).
 *   4. Escucha mensajes 'query'. Cuando llega uno:
 *      a. Busca la acción en queries.json → obtiene el SQL
 *      b. Valida parámetros requeridos y tipos
 *      c. Verifica modo solo-lectura
 *      d. Ejecuta contra la BD local
 *      e. Registra en el log de auditoría
 *   5. Envía el resultado de vuelta al servidor central.
 */

const WebSocket = require('ws');
const path = require('path');

// ─── Módulos del agente ──────────────────────────────────────────────────────
const { executeQuery, closePool } = require('./db/connector');
const { resolve: resolveQuery, getAvailableActions } = require('./lib/queryResolver');
const audit = require('./lib/audit');

// ─── Cargar configuración ────────────────────────────────────────────────────
// Lee el archivo de configuración local. Aquí el cliente pone sus credenciales.
const config = require(path.resolve(__dirname, 'config.json'));

const {
  clienteId,       // ID único de este cliente (ej. 'empresa_abc')
  serverUrl,       // URL del servidor central (ej. 'wss://mi-servidor.com/ws')
  agentSecret,     // Secret único de este agente (debe coincidir con agents.json del servidor)
  readOnly = false, // Modo solo-lectura: true = rechaza cualquier query de escritura
  dbEngine = 'mssql', // Motor de BD: "mssql", "postgres" o "mysql"
  reconnect: {
    initialDelayMs = 1000,    // Tiempo inicial de espera antes de reconectar (1 seg)
    maxDelayMs = 30000,       // Tiempo máximo de espera (30 segs)
    backoffMultiplier = 2,    // Multiplicador (1s -> 2s -> 4s -> 8s...)
  } = {},
  db: dbConfig,    // Credenciales para conectarse a la BD local
} = config;

// ─── Estado de reconexión ────────────────────────────────────────────────────
let currentDelay = initialDelayMs;
let reconnectTimer = null;
let ws = null;
let isShuttingDown = false;

// ─── Conexión WebSocket ──────────────────────────────────────────────────────
/**
 * Establece la conexión WebSocket con el servidor central.
 * Incluye autenticación con secret por agente y envío del action manifest.
 */
function connect() {
  if (isShuttingDown) return;

  console.log(`[Agent] Conectando a ${serverUrl} ...`);
  ws = new WebSocket(serverUrl);

  // Cuando la conexión TCP se establece exitosamente:
  ws.on('open', () => {
    console.log('[Agent] Conectado. Enviando autenticación...');
    currentDelay = initialDelayMs; // Reiniciamos el contador de espera a 1s

    // ── NUEVO: Enviamos autenticación + Action Manifest ──
    // El servidor guardará la lista de acciones para poder validar
    // ANTES de reenviar una petición (evita esperas de 30s por acciones inválidas).
    ws.send(JSON.stringify({
      type: 'auth',
      clienteId,
      secret: agentSecret,
      actions: getAvailableActions(), // ['get_clientes', 'get_productos', ...]
    }));
  });

  // Cuando llega cualquier mensaje desde el servidor central:
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.error('[Agent] Mensaje no-JSON recibido');
      return;
    }

    // Dependiendo del tipo de mensaje, actuamos
    switch (msg.type) {
      // El servidor nos dice si la autenticación fue correcta o no
      case 'authResult':
        if (msg.success) {
          console.log(`[Agent] ✔ Autenticado: ${msg.message}`);
        } else {
          console.error(`[Agent] ✘ Auth fallida: ${msg.message}`);
          isShuttingDown = true; // No intentamos reconectar si las credenciales están mal
          ws.close();
        }
        break;

      // El servidor nos envía un nombre de acción para ejecutar (ya no SQL)
      case 'query':
        await handleQuery(msg);
        break;

      case 'error':
        console.warn(`[Agent] Error del servidor: ${msg.message}`);
        break;

      default:
        console.warn(`[Agent] Mensaje desconocido: ${msg.type}`);
    }
  });

  // Cuando la conexión se cae (por fallo de red, se apaga el server, etc.)
  ws.on('close', (code, reason) => {
    console.log(`[Agent] Desconectado (code: ${code}, reason: ${reason})`);
    scheduleReconnect();
  });

  // Cuando ocurre un error a nivel de socket
  ws.on('error', (err) => {
    console.error(`[Agent] Error WS: ${err.message}`);
  });

  // Responder automáticamente a los pings (heartbeats) del servidor
  ws.on('ping', () => {
    ws.pong();
  });
}

// ─── Manejo de queries ───────────────────────────────────────────────────────
/**
 * Recibe el mensaje con el nombre de la acción, resuelve el SQL localmente,
 * valida parámetros, ejecuta contra la BD y devuelve el resultado.
 *
 * FLUJO COMPLETO:
 *   1. El servidor envía: { type: 'query', correlationId, action, params }
 *   2. El agente busca 'action' en queries.json → obtiene el SQL
 *   3. Valida parámetros (requeridos + tipos)
 *   4. Verifica modo solo-lectura
 *   5. Ejecuta el SQL contra la BD local
 *   6. Registra en auditoría
 *   7. Devuelve el resultado al servidor
 */
async function handleQuery(msg) {
  const { correlationId, action, params } = msg;
  const start = Date.now();

  console.log(`[Agent] Query recibida [${correlationId}] → acción: "${action}"`);

  // ── PASO 1: Resolver la acción → SQL (con validación completa) ──
  const resolution = resolveQuery(action, params, readOnly);

  if (!resolution.success) {
    // La acción no existe, faltan parámetros, tipo incorrecto, o es modo solo-lectura
    const elapsed = Date.now() - start;
    console.warn(`[Agent] Query RECHAZADA [${correlationId}]: ${resolution.error}`);

    // Registramos en auditoría el intento fallido
    audit.log({
      action,
      params,
      status: 'ERROR',
      error: resolution.error,
      timeMs: elapsed,
    });

    // Devolvemos el error al servidor
    ws.send(JSON.stringify({
      type: 'queryResult',
      correlationId,
      error: resolution.error,
    }));
    return;
  }

  // ── PASO 2: Ejecutar la query contra la BD local ──
  try {
    const result = await executeQuery(
      dbEngine,                // Motor de BD (mssql, postgres, mysql)
      dbConfig,                // Configuración de conexión
      resolution.sql,          // SQL resuelto desde queries.json
      resolution.params,       // Parámetros validados
      resolution.paramTypes,   // Tipos para el driver
    );

    const elapsed = Date.now() - start;
    console.log(`[Agent] Query OK [${correlationId}] (${elapsed}ms, ${result.recordset.length} filas)`);

    // ── Registrar en auditoría (éxito) ──
    audit.log({
      action,
      params,
      status: 'OK',
      rows: result.recordset.length,
      timeMs: elapsed,
    });

    // Devolvemos el resultado al servidor
    ws.send(JSON.stringify({
      type: 'queryResult',
      correlationId,
      data: result,
    }));
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[Agent] Query ERROR [${correlationId}]:`, err.message);

    // ── Registrar en auditoría (error de BD) ──
    audit.log({
      action,
      params,
      status: 'ERROR',
      error: err.message,
      timeMs: elapsed,
    });

    // Devolvemos el error al servidor
    ws.send(JSON.stringify({
      type: 'queryResult',
      correlationId,
      error: err.message,
    }));
  }
}

// ─── Reconexión con backoff exponencial ──────────────────────────────────────
/**
 * Sistema inteligente de reconexión.
 * Si falla, espera 1s. Si vuelve a fallar, espera 2s, luego 4s, 8s, 16s...
 * hasta un máximo (30s). Esto evita saturar la red o al servidor si hay una caída.
 */
function scheduleReconnect() {
  if (isShuttingDown) {
    console.log('[Agent] Apagándose, no se reconectará.');
    return;
  }

  console.log(`[Agent] Reconectando en ${currentDelay / 1000}s ...`);
  reconnectTimer = setTimeout(() => {
    currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    connect();
  }, currentDelay);
}

// ─── Shutdown limpio ─────────────────────────────────────────────────────────
/**
 * Atrapa señales del sistema operativo (ej. Ctrl+C) y cierra todo ordenadamente:
 * WebSocket, pool de BD, temporizadores.
 */
async function shutdown(signal) {
  console.log(`\n[Agent] Señal ${signal} recibida. Cerrando...`);
  isShuttingDown = true;
  clearTimeout(reconnectTimer);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, 'Agent shutdown');
  }

  await closePool(); // Cerramos el pool de conexiones (sea cual sea el motor)
  process.exit(0);
}

// Escuchamos las señales de cierre
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // Cierre por PM2 o similar

// ─── Arrancar ────────────────────────────────────────────────────────────────
const actions = getAvailableActions();

console.log('═══════════════════════════════════════════════════════');
console.log('  gdata-tunnel-agent v2');
console.log(`  🆔 Cliente:     ${clienteId}`);
console.log(`  🔗 Servidor:    ${serverUrl}`);
console.log(`  🗄️  Motor BD:    ${dbEngine}`);
console.log(`  🗄️  DB:          ${dbConfig.server}/${dbConfig.database}`);
console.log(`  🔒 Solo-lectura: ${readOnly ? 'SÍ ✔' : 'NO'}`);
console.log(`  📋 Acciones:    ${actions.length} (${actions.join(', ')})`);
console.log('═══════════════════════════════════════════════════════');

connect(); // Iniciar todo
