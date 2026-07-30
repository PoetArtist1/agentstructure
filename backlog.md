# 📋 Product Backlog — AgentStructure

Este archivo representa el **Product Backlog** oficial del proyecto,
estructurado bajo la metodología ágil Scrum durante la Fase I (Planificación y
Requerimientos). Cada ítem está redactado utilizando la técnica de **Historias
de Usuario** y mapeado directamente con los componentes lógicos implementados en
este repositorio.

---

## 🚦 Historias de Usuario Priorizadas

### [Alta] HU-01: Autenticación de Aplicaciones Externas (API Gateway)

- **Como** administrador de infraestructura en la nube,
- **Quiero** un broker que reciba peticiones HTTP externas de las Apps y valide
  su origen de manera centralizada,
- **Para** asegurar que solo clientes autorizados consulten la arquitectura.
- **Criterios de Aceptación:**
  - El sistema implementa autenticación por cabeceras `X-Api-Key` configuradas
    desde un entorno `.env`.
  - Si la clave es inválida o está ausente, retorna inmediatamente un error
    HTTP 401.
- **Componente Implementado:** `server/middleware/apiKey.js`, `server/index.js`

### [Alta] HU-02: Identificador Único de Transacciones (Correlation ID)

- **Como** administrador de infraestructura en la nube,
- **Quiero** que el servidor asigne un identificador único a cada transacción
  entrante,
- **Para** poder rastrearla asíncronamente en los logs y evitar colisiones de
  hilos.
- **Criterios de Aceptación:**
  - Al recibir un _POST_ HTTP válido en `/query/:clienteId`, el sistema invoca
    la función generadora de identificadores de 128 bits.
  - El ciclo de vida de la petición HTTP queda en pausa controlada por un
    temporizador (_timeout_) configurable.
- **Componente Implementado:** `server/routes/api.js` (Función `createPending`
  usando `uuid`)

### [Alta] HU-03: Túnel Inverso Bidireccional (WebSockets)

- **Como** arquitecto de sistemas,
- **Quiero** un canal full-duplex que permita la comunicación bidireccional
  entre la nube y la red local,
- **Para** evadir el redireccionamiento de puertos entrantes o el uso de
  complejas VPN.
- **Criterios de Aceptación:**
  - El canal de comunicación se establece mediante un túnel inverso de salida
    (_outbound_) utilizando conexiones WebSocket persistentes.
  - El servidor implementa subrutinas nativas de ping/pong periódicas cada 30
    segundos para limpiar sockets huérfanos.
- **Componente Implementado:** `server/ws/socketHandler.js`, `agent/index.js`

### [Alta] HU-04: Autenticación de Agentes por Secreto Criptográfico

- **Como** administrador de base de datos local,
- **Quiero** validar la identidad de cada agente que intenta abrir un túnel
  inverso hacia el broker en la nube,
- **Para** evitar conexiones maliciosas o suplantaciones de identidad.
- **Criterios de Aceptación:**
  - Cada agente debe proveer un `clienteId` y un secreto criptográfico único e
    independiente registrado en el backend (`agents.json`).
  - Al autenticarse con éxito, el agente declara dinámicamente su manifiesto de
    acciones (_Action Manifest_) para validación temprana.
- **Componente Implementado:** `server/lib/registry.js` (Función
  `registerAgent`), `server/ws/socketHandler.js`

### [Alta] HU-06: Aislamiento SQL y Mapeo Local (Lista Blanca)

- **Como** administrador de base de datos local,
- **Quiero** que el código SQL resida exclusivamente en mi red interna y que
  desde el exterior solo se puedan invocar identificadores preconfigurados de
  solo lectura,
- **Para** anular por completo el riesgo de ataques de Inyección SQL
  trans-perimetrales.
- **Criterios de Aceptación:**
  - El servidor externo nunca envía ni conoce sentencias SQL; solo transmite
    nombres de acciones lógicas.
  - El agente mapea el ID recibido contra un archivo de configuración local y
    aplica parámetros tipificados de forma sanitizada.
- **Componente Implementado:** `agent/queries.json`,
  `agent/lib/queryResolver.js`

### [Alta] HU-07: Abstracción Multi-Motor (Patrón Factory)

- **Como** administrador de base de datos local,
- **Quiero** que el agente sea compatible con diferentes motores relacionales
  comerciales de forma agnóstica,
- **Para** integrarse a la infraestructura preexistente de la organización sin
  costes de migración.
- **Criterios de Aceptación:**
  - El agente encapsula los drivers de conexión detrás de una interfaz unificada
    basada en un patrón de diseño creacional.
  - Se otorga soporte nativo para interactuar de forma transparente con
    Microsoft SQL Server, PostgreSQL y MySQL.
- **Componente Implementado:** `agent/db/connector.js`, `agent/db/drivers/`
  (`mssqlDriver.js`, `pgDriver.js`, `mysqlDriver.js`)

### [Alta] HU-08: Log de Auditoría Transaccional Local

- **Como** oficial de seguridad de la información,
- **Quiero** un registro histórico inmutable y local de todas las operaciones y
  parámetros consultados desde la nube,
- **Para** mantener una trazabilidad perimetral estricta exigida por auditorías
  fiscales o comerciales.
- **Criterios de Aceptación:**
  - Cada consulta procesada o rechazada se añade de inmediato al final de un log
    en formato de texto plano estructurado.
  - El sistema genera y rota un archivo físico de auditoría de manera diaria de
    forma automatizada.
- **Componente Implementado:** `agent/lib/audit.js` (Ruta física local en
  `agent/logs/`)

### [Media] HU-05: Tolerancia a Fallos de Red (Exponential Backoff)

- **Como** ingeniero de seguridad de redes,
- **Quiero** que el agente local sea tolerante a fallas de conectividad y
  reintente el enlace asíncronamente,
- **Para** asegurar la alta disponibilidad del túnel sin saturar la
  infraestructura local ante caídas del ISP.
- **Criterios de Aceptación:**
  - Ante la pérdida de conexión del socket, el agente ejecuta subrutinas
    automáticas de reintento.
  - Los tiempos de espera se incrementan progresivamente aplicando un algoritmo
    multiplicador de retroceso (_Backoff_).
- **Componente Implementado:** `agent/index.js` (Mecanismo `scheduleReconnect`)

### [Media] HU-09: Optimización Transaccional en la Nube (Memory Cache)

- **Como** administrador de infraestructura en la nube,
- **Quiero** que el servidor almacene temporalmente las respuestas de consultas
  de lectura frecuentes,
- **Para** optimizar el rendimiento general y mitigar la latencia de peticiones
  repetitivas.
- **Criterios de Aceptación:**
  - El _API Gateway_ implementa un almacenamiento temporal indexado por
    variables deterministas (clienteId, acción y parámetros ordenados).
  - Al haber un impacto positivo de caché (_Cache Hit_), se descarta el tráfico
    por el túnel WebSocket, devolviendo la respuesta desde la memoria RAM.
  - La caché tiene un límite de 1000 entradas simultáneas (`maxKeys: 1000`) para
    proteger la RAM del servidor contra crecimiento descontrolado (OOM).
  - Las respuestas que superen 1 MB no se almacenan en caché para evitar que un
    payload masivo sature el heap de Node.js.
- **Componente Implementado:** `server/lib/cache.js` (Uso de la librería
  `node-cache`)

### [Baja] HU-10: Asistente de Configuración (Asistente CLI)

- **Como** técnico de despliegue,
- **Quiero** un asistente automatizado multiplataforma que inicialice las
  configuraciones base de la arquitectura rápidamente,
- **Para** mitigar errores humanos de digitación manual en la puesta en marcha.
- **Criterios de Aceptación:**
  - El software cuenta con un script interactivo ejecutable por consola que
    solicita los parámetros requeridos al operador usando la interfaz
    `readline`.
  - El asistente genera automáticamente las plantillas físicas de configuración
    (.env, agents.json, config.json) y ejecuta el aprovisionamiento de
    dependencias.
- **Componente Implementado:** `install.js` en la raíz del proyecto

### [Media] HU-11: Compresión de Datos en Tránsito (GZIP + Deflate)

- **Como** administrador de infraestructura en la nube,
- **Quiero** que todas las respuestas HTTP y los mensajes WebSocket se compriman
  automáticamente antes de transmitirse por la red,
- **Para** reducir el consumo de ancho de banda en ~90% y proteger la velocidad
  de subida (upload) de la red local del Agente On-Premise.
- **Criterios de Aceptación:**
  - El Servidor Central utiliza el middleware `compression` de Express para
    comprimir automáticamente todas las respuestas HTTP con GZIP.
  - Los mensajes WebSocket entre el Servidor y el Agente se comprimen usando la
    extensión nativa `perMessageDeflate` del protocolo WebSocket (RFC 7692).
- **Componente Implementado:** `server/index.js` (middleware `compression` y
  opción `perMessageDeflate` en `WebSocketServer`), `agent/index.js` (opción
  `perMessageDeflate` en cliente WebSocket)

### [Media] HU-12: Paginación Nativa de Consultas

- **Como** desarrollador de aplicaciones consumidoras,
- **Quiero** poder solicitar datos en páginas de tamaño configurable en lugar de
  recibir todos los registros de golpe,
- **Para** evitar saturar la red, la RAM y el CPU tanto del Agente como del
  Servidor Central al consultar tablas con miles de registros.
- **Criterios de Aceptación:**
  - El `queries.json` del Agente soporta la definición de consultas paginadas
    usando parámetros tipificados `@Offset` (tipo `int`) y `@Limit` (tipo `int`).
  - Se incluye un ejemplo funcional de paginación para SQL Server usando la
    sintaxis `OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`.
- **Componente Implementado:** `agent/queries.json` (acción
  `get_clientes_paginados`)
