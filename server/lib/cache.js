/**
 * cache.js — Módulo de Caché en Memoria para el Servidor GData.
 *
 * PROPÓSITO:
 *   Almacenar temporalmente las respuestas del agente en la RAM del VPS.
 *   Si 50 usuarios piden el mismo dato, el agente solo trabaja UNA VEZ.
 *   Los otros 49 reciben la respuesta instantáneamente desde la caché.
 *
 * TECNOLOGÍA: node-cache (almacenamiento en memoria, sin Redis, sin dependencias externas).
 *
 * LIMITACIÓN IMPORTANTE:
 *   La caché es por proceso. Si reinicias el servidor, la caché se limpia.
 *   Esto es ideal para datos que no son críticos en tiempo real.
 *
 * NOTA SOBRE EL TTL (Time-To-Live):
 *   El TTL ya no se define en un queries.json del servidor (ese archivo ya no existe).
 *   Se puede configurar un TTL global por variable de entorno (CACHE_DEFAULT_TTL),
 *   o el servidor puede usar un TTL fijo para todas las acciones cacheables.
 */

const NodeCache = require('node-cache');

// ─── Instancia del caché ──────────────────────────────────────────────────────
// checkperiod: cada cuántos segundos node-cache barre y elimina las entradas expiradas.
// useClones: false es más rápido. Los datos se devuelven por referencia, no por copia.
// maxKeys: límite máximo de entradas almacenadas para evitar crecimiento descontrolado de RAM.
const cache = new NodeCache({
  checkperiod: 60,    // Limpieza de entradas expiradas cada 60 segundos
  useClones: false,   // Mejor rendimiento: no clona los objetos al leer/escribir
  maxKeys: 1000,      // Máximo 1000 entradas en caché (protección contra OOM)
});

// TTL por defecto en segundos (configurable desde .env, default: sin caché)
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 0;

// Tamaño máximo permitido para almacenar una respuesta en caché (en bytes).
// Las respuestas que superen este límite se sirven directamente sin cachear,
// evitando que un único payload masivo sature la RAM del proceso Node.js.
const MAX_CACHE_VALUE_BYTES = 1 * 1024 * 1024; // 1 MB

// ─── Generar llave de caché ───────────────────────────────────────────────────
/**
 * Genera una llave única y determinista para identificar una petición.
 * Si el clienteId, la acción y los parámetros son los mismos, la llave siempre será la misma.
 *
 * @param {string} clienteId - El ID del cliente (ej. 'empresa_abc')
 * @param {string} action    - El nombre de la acción (ej. 'get_clientes')
 * @param {object} params    - Los parámetros de la acción (ej. { IdCliente: '005' })
 * @returns {string} La llave de caché (ej. 'empresa_abc::get_clientes::{"IdCliente":"005"}')
 */
function buildKey(clienteId, action, params) {
  // Ordenamos las claves del objeto params para que { a:1, b:2 } y { b:2, a:1 }
  // generen la misma llave (son la misma petición, solo en diferente orden).
  const sortedParams = params && Object.keys(params).length > 0
    ? JSON.stringify(Object.keys(params).sort().reduce((acc, k) => {
        acc[k] = params[k];
        return acc;
      }, {}))
    : '{}';

  return `${clienteId}::${action}::${sortedParams}`;
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Intenta obtener un valor de la caché.
 *
 * @param {string} clienteId - El ID del cliente
 * @param {string} action    - El nombre de la acción
 * @param {object} params    - Los parámetros de la acción
 * @returns {any | undefined} Los datos cacheados, o `undefined` si no existe o expiró.
 */
function get(clienteId, action, params) {
  const key = buildKey(clienteId, action, params);
  return cache.get(key); // node-cache devuelve `undefined` si no existe
}

/**
 * Guarda un valor en la caché con un tiempo de vida (TTL).
 * Si el payload supera MAX_CACHE_VALUE_BYTES (~1 MB), se omite silenciosamente
 * para proteger la RAM del servidor bajo carga concurrente alta.
 *
 * @param {string} clienteId  - El ID del cliente
 * @param {string} action     - El nombre de la acción
 * @param {object} params     - Los parámetros de la acción
 * @param {any}    value      - Los datos a guardar (la respuesta del agente)
 * @param {number} [ttlSeconds] - Cuántos segundos deben vivir estos datos en caché.
 *                                Si no se especifica, usa el TTL por defecto del .env.
 */
function set(clienteId, action, params, value, ttlSeconds) {
  const ttl = ttlSeconds || DEFAULT_TTL;
  if (ttl <= 0) return; // Si el TTL es 0, no cacheamos nada

  // ── Protección de RAM: no cachear payloads gigantes ──
  // Estimamos el tamaño del valor serializándolo a JSON.
  // Si supera 1 MB, lo descartamos para evitar saturar el heap de Node.js.
  try {
    const estimatedSize = JSON.stringify(value).length;
    if (estimatedSize > MAX_CACHE_VALUE_BYTES) {
      console.log(`[Cache] SKIP: Payload demasiado grande (${(estimatedSize / 1024).toFixed(0)} KB). No se almacenará en caché.`);
      return;
    }
  } catch {
    // Si no se puede serializar, no cacheamos
    return;
  }

  const key = buildKey(clienteId, action, params);
  cache.set(key, value, ttl);
}

/**
 * Invalida (elimina) todas las entradas de caché que pertenezcan a un cliente específico.
 * Útil si el cliente hace una escritura y necesitas limpiar su caché.
 *
 * @param {string} clienteId - El ID del cliente cuya caché se debe limpiar
 */
function invalidateClient(clienteId) {
  const allKeys = cache.keys();
  const clientKeys = allKeys.filter((k) => k.startsWith(`${clienteId}::`));
  if (clientKeys.length > 0) {
    cache.del(clientKeys);
    console.log(`[Cache] ${clientKeys.length} entradas invalidadas para "${clienteId}"`);
  }
}

/**
 * Devuelve estadísticas del estado actual de la caché.
 * Útil para diagnósticos y monitoreo.
 *
 * @returns {{ hits: number, misses: number, keys: number, ksize: number, vsize: number }}
 */
function stats() {
  return cache.getStats();
}

module.exports = { get, set, invalidateClient, stats };
