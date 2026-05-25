/**
 * api.js — Rutas REST expuestas a la App (v2).
 *
 * CAMBIOS RESPECTO A v1:
 *  • Ya NO existe queries.json en el servidor. El servidor es un "broker" puro:
 *    recibe { action, params } de la App y lo reenvía al agente tal cual.
 *  • El agente es quien tiene las queries definidas localmente y resuelve el SQL.
 *  • NUEVA VALIDACIÓN: Si el agente registró sus acciones disponibles (action manifest),
 *    el servidor verifica que la acción exista ANTES de reenviarla, devolviendo un error
 *    inmediato en vez de esperar el timeout de 30 segundos.
 *  • La caché sigue funcionando igual (usa clienteId + action + params como llave).
 *  • La autenticación por API Key se aplica en el middleware (apiKey.js).
 *
 * ENDPOINTS:
 *   POST /query/:clienteId  → Body: { action: "get_clientes", params: {} }
 *   GET  /agents            → Lista de agentes conectados con sus acciones
 *   GET  /status            → Estadísticas del servidor (agentes, caché, queries pendientes)
 */

const { Router } = require('express');
const registry = require('../lib/registry');
const appCache = require('../lib/cache');

const router = Router();

// Timeout configurable para esperar respuesta del agente (default: 30 segundos)
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS, 10) || 30_000;

// TTL de caché configurable (default: 0 = sin caché)
const CACHE_TTL = parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 0;

// ─── POST /query/:clienteId ──────────────────────────────────────────────────
/**
 * Endpoint principal. La App envía { action, params }.
 * El servidor reenvía al agente sin modificar nada (ya no resuelve SQL).
 * El agente busca la acción en su queries.json local, ejecuta el SQL y responde.
 */
router.post('/query/:clienteId', async (req, res) => {
  const { clienteId } = req.params;
  const { action, params } = req.body;

  // 1. Validar que se envió una acción
  if (!action) {
    return res.status(400).json({
      ok: false,
      error: 'Falta el campo "action" en el body.',
    });
  }

  // Los parámetros son opcionales (algunas queries no necesitan parámetros)
  const receivedParams = params || {};

  // 2. Verificar que el agente del cliente esté conectado
  const ws = registry.getAgent(clienteId);
  if (!ws) {
    return res.status(502).json({
      ok: false,
      error: `Agente "${clienteId}" no está conectado.`,
      connectedAgents: registry.listAgents(),
    });
  }

  // 3. NUEVA VALIDACIÓN: Verificar contra el Action Manifest
  //    Si el agente registró sus acciones al conectarse, podemos validar
  //    ANTES de reenviar. Si la acción no existe, respondemos al instante
  //    con un error claro, sin esperar los 30 segundos del timeout.
  const agentActions = registry.getAgentActions(clienteId);
  if (agentActions.length > 0 && !agentActions.includes(action)) {
    return res.status(404).json({
      ok: false,
      error: `La acción "${action}" no está disponible en el agente "${clienteId}".`,
      availableActions: agentActions,
    });
  }

  // 4. REVISAR CACHÉ: Si hay un resultado cacheado para esta combinación
  //    exacta de clienteId + action + params, lo devolvemos al instante.
  if (CACHE_TTL > 0) {
    const cached = appCache.get(clienteId, action, receivedParams);
    if (cached !== undefined) {
      console.log(`[API] Cache HIT → ${clienteId}::${action}`);
      return res.json({ ok: true, fromCache: true, data: cached });
    }
  }

  try {
    // 5. Crear la correlación y enviar al agente
    //    IMPORTANTE: Ya NO enviamos SQL. Solo el nombre de la acción y los parámetros.
    //    El agente tiene su propio queries.json donde resolverá el SQL.
    const { correlationId, promise } = registry.createPending(QUERY_TIMEOUT_MS);

    ws.send(JSON.stringify({
      type: 'query',
      correlationId,
      action,                 // Nombre de la acción (ej. "get_clientes")
      params: receivedParams, // Parámetros enviados por la App
    }));

    // 6. Esperar la respuesta del agente (o el timeout)
    const data = await promise;

    // 7. GUARDAR EN CACHÉ: Si el TTL está configurado, guardamos la respuesta
    if (CACHE_TTL > 0) {
      appCache.set(clienteId, action, receivedParams, data, CACHE_TTL);
      console.log(`[API] Cache SET → ${clienteId}::${action} (TTL: ${CACHE_TTL}s)`);
    }

    // Respondemos con los datos del agente
    return res.json({ ok: true, fromCache: false, data });
  } catch (err) {
    return res.status(504).json({ ok: false, error: err.message });
  }
});

// ─── GET /agents ─────────────────────────────────────────────────────────────
/**
 * Devuelve la lista de agentes conectados con sus acciones disponibles.
 * Útil para que la App sepa qué agentes están online y qué pueden hacer.
 */
router.get('/agents', (_req, res) => {
  const agents = registry.listAgents().map((id) => ({
    id,
    actions: registry.getAgentActions(id),
  }));
  res.json({ ok: true, agents });
});

// ─── GET /status ─────────────────────────────────────────────────────────────
/**
 * Endpoint de monitoreo. Devuelve estadísticas del servidor:
 * agentes conectados, queries pendientes, estado de la caché.
 */
router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    server: registry.stats(),
    cache: appCache.stats(),
  });
});

module.exports = router;
