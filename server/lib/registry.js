/**
 * registry.js — Registro central de agentes conectados, acciones disponibles y correlación de peticiones.
 *
 * Mantiene en memoria RAM tres estructuras fundamentales para el túnel:
 *
 *  1. agents       → Map<clienteId, WebSocket>
 *     Qué agente está conectado y cuál es su "tubo" de comunicación.
 *
 *  2. agentActions → Map<clienteId, string[]>
 *     Las acciones (queries) que cada agente declaró como disponibles al autenticarse.
 *     Esto permite al servidor validar ANTES de reenviar si la acción existe en el agente.
 *
 *  3. pending      → Map<correlationId, { resolve, reject, timer }>
 *     Peticiones HTTP que están en pausa esperando que el agente responda.
 */

const { v4: uuidv4 } = require('uuid');

// ─── Almacenes en memoria ────────────────────────────────────────────────────

/** Websockets activos. Clave: clienteId, Valor: WebSocket */
/** @type {Map<string, import('ws').WebSocket>} */
const agents = new Map();

/** Acciones disponibles por agente. Clave: clienteId, Valor: array de nombres de acción */
/** @type {Map<string, string[]>} */
const agentActions = new Map();

/** Promesas pendientes. Clave: correlationId (UUID), Valor: { resolve, reject, timer } */
/** @type {Map<string, { resolve: Function, reject: Function, timer: NodeJS.Timeout }>} */
const pending = new Map();

// ─── Gestión de Agentes ──────────────────────────────────────────────────────

/**
 * Registra un agente autenticado en el sistema junto con sus acciones disponibles.
 * Si ya existe uno conectado con el mismo clienteId (ej. se reconectó rápido),
 * cerramos amablemente el anterior y guardamos el nuevo.
 *
 * @param {string} clienteId - ID único del agente/empresa
 * @param {import('ws').WebSocket} ws - Conexión WebSocket del agente
 * @param {string[]} [actions=[]] - Lista de nombres de acciones que el agente soporta
 */
function registerAgent(clienteId, ws, actions = []) {
  // Si ya había un agente con este ID, cerramos la conexión vieja
  const existing = agents.get(clienteId);
  if (existing && existing.readyState === existing.OPEN) {
    console.warn(`[Registry] Agente duplicado para "${clienteId}". Cerrando conexión anterior.`);
    existing.close(4001, 'Reemplazado por nueva conexión');
  }

  // Registramos el nuevo agente y sus acciones disponibles
  agents.set(clienteId, ws);
  agentActions.set(clienteId, actions);

  console.log(`[Registry] Agente registrado: "${clienteId}" (total: ${agents.size}, acciones: ${actions.length})`);
}

/**
 * Elimina el registro de un agente cuando se desconecta.
 * La comprobación (agents.get(clienteId) === ws) evita que un socket viejo
 * borre por accidente el registro de una nueva reconexión que acaba de entrar.
 *
 * @param {string} clienteId - ID del agente a desregistrar
 * @param {import('ws').WebSocket} ws - Socket específico a verificar
 */
function unregisterAgent(clienteId, ws) {
  if (agents.get(clienteId) === ws) {
    agents.delete(clienteId);
    agentActions.delete(clienteId);
    console.log(`[Registry] Agente desregistrado: "${clienteId}" (total: ${agents.size})`);
  }
}

/**
 * Obtiene el WebSocket activo de un agente para poder enviarle mensajes.
 * Retorna null si el agente no está conectado o su socket se cerró.
 *
 * @param {string} clienteId - ID del agente
 * @returns {import('ws').WebSocket | null}
 */
function getAgent(clienteId) {
  const ws = agents.get(clienteId);
  if (ws && ws.readyState === ws.OPEN) return ws;
  return null;
}

/**
 * Devuelve un array con los IDs de todos los agentes actualmente conectados.
 *
 * @returns {string[]}
 */
function listAgents() {
  return [...agents.keys()];
}

/**
 * Obtiene la lista de acciones disponibles de un agente específico.
 * Esto se usa para validar si una acción existe ANTES de reenviarla al agente,
 * evitando esperas innecesarias de 30 segundos por acciones inexistentes.
 *
 * @param {string} clienteId - ID del agente
 * @returns {string[]} Array de nombres de acciones disponibles, o vacío si no se registraron
 */
function getAgentActions(clienteId) {
  return agentActions.get(clienteId) || [];
}

// ─── Gestión de Peticiones Pendientes (Correlation) ──────────────────────────

/**
 * Crea una "Promesa" que pone en pausa la ejecución en api.js.
 * Devuelve un UUID (correlationId) que se le debe enviar al agente.
 * Si el agente no responde en 'timeoutMs', la promesa se rechaza sola (Timeout).
 *
 * @param {number} [timeoutMs=30000] - Tiempo máximo de espera en milisegundos
 * @returns {{ correlationId: string, promise: Promise<any> }}
 */
function createPending(timeoutMs = 30_000) {
  const correlationId = uuidv4(); // Generamos el ID único

  const promise = new Promise((resolve, reject) => {
    // Iniciamos la cuenta regresiva del timeout
    const timer = setTimeout(() => {
      pending.delete(correlationId); // Limpiamos la memoria
      reject(new Error(`Timeout: el agente no respondió en ${timeoutMs}ms`));
    }, timeoutMs);

    // Guardamos las "llaves" para resolver o rechazar esta promesa más tarde desde socketHandler.js
    pending.set(correlationId, { resolve, reject, timer });
  });

  return { correlationId, promise };
}

/**
 * Cuando el socketHandler recibe el mensaje 'queryResult' del agente, llama a esta función.
 * Busca la promesa que estaba en pausa y le inyecta los datos (o el error).
 *
 * @param {string}  correlationId - El UUID original que identifica la petición
 * @param {any}     data          - Resultado de la query o el mensaje de error
 * @param {boolean} [isError=false] - Si es true, la promesa falla; si es false, la promesa tiene éxito
 * @returns {boolean} true si se resolvió correctamente, false si ya expiró o no existía
 */
function resolvePending(correlationId, data, isError = false) {
  const entry = pending.get(correlationId);
  if (!entry) return false; // El timer ya expiró y se borró, o es un ID inválido

  // Cancelamos la cuenta regresiva del timeout porque ya respondió
  clearTimeout(entry.timer);
  pending.delete(correlationId); // Liberamos RAM

  // Despertamos a api.js pasándole los datos o el error
  if (isError) {
    entry.reject(new Error(data));
  } else {
    entry.resolve(data);
  }
  return true;
}

// ─── Estadísticas ────────────────────────────────────────────────────────────

/**
 * Información de monitorización usada por el endpoint GET /status.
 * Incluye ahora las acciones disponibles por agente para diagnóstico.
 *
 * @returns {{ agentsConnected: number, pendingQueries: number, agents: Array<{id: string, actions: string[]}> }}
 */
function stats() {
  const agentList = listAgents().map((id) => ({
    id,
    actions: getAgentActions(id),
  }));

  return {
    agentsConnected: agents.size,
    pendingQueries: pending.size,
    agents: agentList,
  };
}

module.exports = {
  registerAgent,
  unregisterAgent,
  getAgent,
  listAgents,
  getAgentActions,
  createPending,
  resolvePending,
  stats,
};
