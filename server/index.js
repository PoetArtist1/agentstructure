/**
 * gdata-tunnel-server v2 — Servidor central del Túnel Inverso por Aplicación.
 *
 * ARQUITECTURA:
 *  Este servidor actúa como un "broker" (intermediario) entre las aplicaciones
 *  consumidoras y los agentes on-premise instalados en la red de cada empresa.
 *
 *  Combina:
 *   • Express (API REST) para recibir peticiones de la App (React Native, Web, etc.)
 *   • WebSocket Server para mantener conexiones persistentes con los Agentes on-premise
 *
 * SEGURIDAD (Doble capa):
 *   • Capa HTTP: API Key (header X-Api-Key) protege los endpoints REST
 *   • Capa WS:  Secret por agente (agents.json) protege las conexiones WebSocket
 *
 * FLUJO:
 *   App → POST /query/empresa_abc { action, params }
 *         → [API Key valida] → [Agente conectado] → [Reenvía action+params por WS]
 *         → Agente resuelve SQL localmente → Devuelve datos → Responde a la App
 *
 * DIFERENCIA CON v1:
 *   El servidor ya NO tiene queries.json. No conoce el SQL ni el esquema de la BD
 *   de ningún cliente. Solo reenvía nombres de acciones y parámetros.
 *   La soberanía de los datos está 100% del lado del agente/empresa.
 */

// Carga las variables de entorno desde el archivo .env a process.env
require('dotenv').config();

// Módulos nativos y de terceros necesarios
const http = require('http');     // Para crear el servidor HTTP base
const express = require('express'); // Framework para la API REST
const cors = require('cors');      // Middleware para permitir peticiones cross-origin
const helmet = require('helmet');  // Middleware de seguridad (cabeceras HTTP protectoras)
const { WebSocketServer } = require('ws'); // Librería para el servidor WebSocket

// Importa nuestras rutas, middlewares y manejadores personalizados
const apiKeyAuth = require('./middleware/apiKey');
const apiRoutes = require('./routes/api');
const { initSocketHandler } = require('./ws/socketHandler');

// ─── Configuración ───────────────────────────────────────────────────────────
// Toma el puerto de las variables de entorno o usa 3500 por defecto
const PORT = parseInt(process.env.PORT, 10) || 3500;

// ─── Express App ─────────────────────────────────────────────────────────────
// Crea la instancia de la aplicación Express
const app = express();

// ─── Middlewares Globales ────────────────────────────────────────────────────
app.use(helmet());         // Protege la app configurando varios headers HTTP de seguridad
app.use(cors());           // Permite peticiones desde cualquier origen (útil para Apps móviles/web)
app.use(express.json());   // Parsea los cuerpos de las peticiones que vienen en formato JSON

// Middleware para logging básico: imprime en consola cada petición HTTP que llega
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next(); // Pasa el control al siguiente middleware o ruta
});

// ─── Rutas ───────────────────────────────────────────────────────────────────

// Las rutas /query/* requieren API Key (la App debe enviar X-Api-Key en los headers)
app.use('/query', apiKeyAuth);

// Monta todas las rutas de la API (query, agents, status)
app.use('/', apiRoutes);

// Manejador para rutas no encontradas (404)
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Error handler global: atrapa cualquier error no manejado en las rutas anteriores
app.use((err, _req, res, _next) => {
  console.error('[HTTP] Error no manejado:', err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// ─── Servidor HTTP ───────────────────────────────────────────────────────────
// Crea el servidor HTTP vinculándolo con la app de Express
const server = http.createServer(app);

// ─── WebSocket Server (montado sobre el mismo puerto) ────────────────────────
// Crea el servidor WebSocket y lo vincula al mismo servidor HTTP.
// Los agentes se conectan a ws://host:PORT/ws
const wss = new WebSocketServer({
  server,                          // Reutiliza el servidor de Express
  path: '/ws',                     // Ruta específica para los WebSockets
  maxPayload: 10 * 1024 * 1024,   // 10 MB máximo por mensaje (para soportar resultados grandes)
});

// Inicializa la lógica para manejar las conexiones de los agentes
initSocketHandler(wss);

// ─── Arrancar ────────────────────────────────────────────────────────────────
// Pone al servidor a escuchar peticiones en el puerto configurado
server.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  gdata-tunnel-server v2');
  console.log(`  🌐 API REST:     http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket:    ws://localhost:${PORT}/ws`);
  console.log(`  📊 Status:       http://localhost:${PORT}/status`);
  console.log(`  🔐 API Key:      ${process.env.API_KEY ? 'Configurada ✔' : '⚠ NO CONFIGURADA'}`);
  console.log('═══════════════════════════════════════════════════════');
});
