# DOCUMENTACIÓN COMPLETA DEL PROYECTO — AgentStructure

> **Propósito de este documento:** Este archivo contiene una descripción exhaustiva, técnica y funcional del proyecto de software **AgentStructure**, desarrollado como propuesta de **Tesis de Grado**. El objetivo es que este documento sirva como insumo completo para comprender el proyecto en su totalidad — su problemática, su solución arquitectónica, cada componente de código, sus mecanismos de seguridad, sus patrones de diseño, sus tecnologías, y su flujo de datos de extremo a extremo — para poder redactar o adaptar los capítulos de un trabajo de investigación académico (Capítulo 1: Planteamiento del Problema, Capítulo 2: Marco Teórico, Capítulo 3: Marco Metodológico / Propuesta Técnica).

---

## ÍNDICE

1. [Información General del Proyecto](#1-información-general-del-proyecto)
2. [Planteamiento del Problema](#2-planteamiento-del-problema)
3. [Objetivos del Proyecto](#3-objetivos-del-proyecto)
4. [Arquitectura General del Sistema](#4-arquitectura-general-del-sistema)
5. [Componentes del Sistema](#5-componentes-del-sistema)
   - 5.1 [Servidor Central (API Gateway + WebSocket Hub)](#51-servidor-central-api-gateway--websocket-hub)
   - 5.2 [Agente On-Premise (Cliente del Túnel Inverso)](#52-agente-on-premise-cliente-del-túnel-inverso)
   - 5.3 [Landing Page (Sitio Web de Presentación)](#53-landing-page-sitio-web-de-presentación)
   - 5.4 [Instalador de Windows (Aplicación de Escritorio)](#54-instalador-de-windows-aplicación-de-escritorio)
   - 5.5 [Script de Instalación por Terminal (install.js)](#55-script-de-instalación-por-terminal-installjs)
6. [Flujo de Datos Completo (De extremo a extremo)](#6-flujo-de-datos-completo-de-extremo-a-extremo)
7. [Modelo de Seguridad (Detallado)](#7-modelo-de-seguridad-detallado)
8. [Patrones de Diseño Implementados](#8-patrones-de-diseño-implementados)
9. [Tecnologías y Dependencias Utilizadas](#9-tecnologías-y-dependencias-utilizadas)
10. [Estructura de Archivos del Proyecto](#10-estructura-de-archivos-del-proyecto)
11. [Detalle Técnico Archivo por Archivo](#11-detalle-técnico-archivo-por-archivo)
12. [Sistema de Auditoría y Trazabilidad](#12-sistema-de-auditoría-y-trazabilidad)
13. [Sistema de Caché en Memoria](#13-sistema-de-caché-en-memoria)
14. [Soporte Multi-Motor de Base de Datos](#14-soporte-multi-motor-de-base-de-datos)
15. [Sistema de Reconexión Automática](#15-sistema-de-reconexión-automática)
16. [Archivos de Configuración (Ejemplos Reales)](#16-archivos-de-configuración-ejemplos-reales)
17. [Diagrama de Secuencia del Flujo Completo](#17-diagrama-de-secuencia-del-flujo-completo)
18. [Glosario de Términos Técnicos](#18-glosario-de-términos-técnicos)

---

## 1. INFORMACIÓN GENERAL DEL PROYECTO

- **Nombre del proyecto:** AgentStructure
- **Nombre interno del software:** gdata-tunnel (versión 2)
- **Tipo de proyecto:** Tesis de Grado
- **Área de aplicación:** Integración de sistemas, conectividad segura de bases de datos, arquitectura híbrida Cloud/On-Premise
- **Lenguaje de programación principal:** JavaScript (Node.js)
- **Repositorio:** https://github.com/PoetArtist1/agentstructure
- **Licencia:** Proyecto académico privado
- **Versión actual:** 2.0.0

---

## 2. PLANTEAMIENTO DEL PROBLEMA

### 2.1 Contexto

En la actualidad, muchas organizaciones — especialmente pequeñas y medianas empresas (PyMEs) — operan con sistemas administrativos o ERP (Enterprise Resource Planning) que almacenan su información contable, de inventario, clientes y facturación en **bases de datos locales** dentro de su red corporativa (On-Premise). Estos sistemas generalmente utilizan motores como Microsoft SQL Server, PostgreSQL o MySQL instalados en servidores físicos dentro de las oficinas de la empresa.

Al mismo tiempo, estas organizaciones necesitan cada vez más que aplicaciones externas — como aplicaciones móviles para vendedores, portales web para clientes, dashboards gerenciales en la nube, o integraciones con otras plataformas — puedan **consultar datos específicos** de esas bases de datos locales en tiempo real.

### 2.2 El Problema Específico

La integración entre aplicaciones externas (en la nube o internet) y bases de datos locales (on-premise) presenta varios desafíos críticos:

1. **Exposición de credenciales:** La práctica convencional requiere que el servidor en la nube almacene las credenciales de acceso directo a la base de datos del cliente (usuario, contraseña, IP, puerto). Si el servidor en la nube es comprometido, las bases de datos de TODOS los clientes quedan expuestas.

2. **Apertura de puertos en el firewall:** Para que un servidor externo se conecte directamente a una base de datos local, la empresa necesita abrir puertos de entrada en su firewall corporativo (puerto 1433 para SQL Server, 5432 para PostgreSQL, 3306 para MySQL). Esto va en contra de las políticas de seguridad de la mayoría de las organizaciones y crea vectores de ataque adicionales.

3. **SQL en el servidor externo:** En arquitecturas convencionales, las sentencias SQL residen en el servidor web en la nube. Esto significa que el proveedor del servicio en la nube tiene control total sobre qué queries se ejecutan contra la base de datos del cliente, pudiendo potencialmente leer, modificar o eliminar datos sin que el cliente lo sepa.

4. **Falta de trazabilidad local:** El cliente/empresa no tiene forma de saber exactamente qué datos se consultaron, cuándo, con qué parámetros, o si hubo intentos de acceso no autorizados, ya que toda esa lógica ocurre fuera de su red.

5. **Dependencia de infraestructura compleja:** Soluciones como VPN site-to-site, túneles SSH persistentes, o servicios de tipo "reverse proxy" comerciales requieren conocimientos avanzados de redes, configuraciones complejas y costos adicionales que están fuera del alcance de muchas PyMEs.

### 2.3 Consecuencias del Problema

- Las empresas rechazan proyectos de integración por miedo a comprometer la seguridad de sus datos.
- Los desarrolladores de aplicaciones móviles y web se ven obligados a crear "exportaciones" manuales (archivos CSV, Excel, copias de base de datos) en lugar de consultas en tiempo real.
- Se pierden oportunidades de negocio por no poder ofrecer información actualizada al instante a vendedores, clientes y gerentes.
- Las empresas que sí aceptan la integración lo hacen exponiendo credenciales y abriendo puertos, creando vulnerabilidades de seguridad significativas.

---

## 3. OBJETIVOS DEL PROYECTO

### 3.1 Objetivo General

Diseñar e implementar una arquitectura de software híbrida basada en el patrón **Agente-Servidor** con **túnel inverso por WebSockets** que permita la consulta segura de bases de datos on-premise desde aplicaciones externas, garantizando la soberanía de los datos, la trazabilidad de los accesos y la no exposición de credenciales ni sentencias SQL fuera de la red corporativa.

### 3.2 Objetivos Específicos

1. Desarrollar un **Servidor Central** (API Gateway) desplegable en la nube que actúe exclusivamente como intermediario de comunicaciones, sin conocer ni almacenar sentencias SQL ni credenciales de bases de datos.

2. Desarrollar un **Agente On-Premise** instalable en la red local de cada empresa que mantenga una conexión inversa (outbound) por WebSocket hacia el servidor central, eliminando la necesidad de abrir puertos entrantes en el firewall corporativo.

3. Implementar un sistema de **lista blanca de consultas** (queries.json) que resida exclusivamente en el agente local, donde la empresa define exactamente qué consultas SQL están permitidas y con qué parámetros.

4. Implementar un modelo de **seguridad de doble capa**: API Key para la comunicación HTTP entre aplicaciones externas y el servidor, y secrets criptográficos individuales por agente para la autenticación del túnel WebSocket.

5. Desarrollar un sistema de **auditoría local** que registre cada consulta ejecutada, sus parámetros, su resultado (éxito/error), y el tiempo de ejecución en archivos de log persistentes dentro de la red de la empresa.

6. Implementar soporte **multi-motor de base de datos** compatible con Microsoft SQL Server, PostgreSQL y MySQL/MariaDB mediante un patrón de diseño Factory que abstrae las diferencias entre motores.

7. Implementar un sistema de **validación de tipos de parámetros** que prevenga inyecciones SQL y garantice la integridad de los datos antes de ejecutar cualquier consulta.

8. Implementar un sistema de **reconexión automática** con backoff exponencial que garantice la disponibilidad del servicio incluso ante caídas temporales de red.

9. Desarrollar un **instalador gráfico** para Windows basado en Electron que simplifique la puesta en marcha del agente y del servidor como servicios del sistema operativo.

10. Desarrollar una **landing page** interactiva con React y Vite para la presentación académica y funcional del proyecto.

---

## 4. ARQUITECTURA GENERAL DEL SISTEMA

### 4.1 Tipo de Arquitectura

AgentStructure implementa una **arquitectura híbrida distribuida de tipo Agente-Servidor** (Agent-Server Architecture) con un patrón de **túnel inverso** (Reverse Tunnel) implementado sobre el protocolo WebSocket.

### 4.2 Concepto Fundamental: Túnel Inverso

En una conexión convencional, el servidor externo (en la nube) inicia la conexión hacia la base de datos local. Esto requiere que la red local tenga puertos abiertos para recibir conexiones entrantes.

En un **túnel inverso**, el flujo se invierte: es el **agente local** (dentro de la red de la empresa) quien inicia una conexión de salida (outbound) hacia el servidor en la nube. Una vez establecida, esta conexión bidireccional permite que el servidor envíe solicitudes al agente a través del canal ya abierto, sin necesidad de abrir ningún puerto adicional en la red local.

**¿Por qué WebSockets?** El protocolo WebSocket (RFC 6455) es ideal para este patrón porque:
- Establece una conexión TCP persistente y bidireccional sobre el puerto 80 o 443 (los mismos puertos HTTP/HTTPS que ya están abiertos en cualquier firewall corporativo).
- Permite comunicación en tiempo real en ambas direcciones (full-duplex).
- Tiene bajo overhead de encabezados comparado con HTTP polling.
- Soporta la transmisión de mensajes estructurados (JSON) de forma nativa.
- Atraviesa firewalls y proxies corporativos sin configuración adicional porque usa los mismos puertos que el tráfico web normal.

### 4.3 Los Tres Actores del Sistema

El sistema consta de tres actores principales:

1. **Aplicación Cliente (App):** Cualquier aplicación externa (móvil, web, dashboard, API de terceros) que necesita consultar datos de una empresa. Se comunica exclusivamente con el Servidor Central mediante peticiones HTTP REST estándar. Nunca tiene contacto directo con la base de datos ni con el agente.

2. **Servidor Central (Cloud):** Un servicio Node.js desplegado en un VPS o servidor en la nube. Actúa como **API Gateway** y **hub de WebSockets**. Recibe peticiones HTTP de las aplicaciones y las reenvía al agente correcto por WebSocket. **No contiene SQL, no conoce las credenciales de bases de datos, y no procesa datos.** Es un intermediario puro.

3. **Agente On-Premise (Red Local):** Un servicio Node.js instalado dentro de la red corporativa de la empresa, en la misma red donde está la base de datos. **Contiene toda la lógica de consultas SQL** (queries.json), las credenciales de la base de datos (config.json), y el módulo de auditoría. Es el único componente que tiene acceso real a los datos.

### 4.4 Principio de Soberanía del Dato

El principio arquitectónico fundamental de AgentStructure es la **soberanía absoluta del dato**: toda información sensible — sentencias SQL, credenciales de base de datos, resultados de consultas, registros de auditoría — reside y se procesa **exclusivamente** dentro de la red local de la empresa. El servidor en la nube es deliberadamente "ignorante": solo conoce nombres de acciones (por ejemplo, "get_clientes"), nunca el SQL detrás de ellas.

### 4.5 Diagrama de Arquitectura (Textual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET / NUBE                                │
│                                                                             │
│  ┌───────────────────┐         HTTPS/REST          ┌──────────────────────┐ │
│  │                   │  POST /query/empresa_abc     │                      │ │
│  │  Aplicación       │ ──────────────────────────►  │  Servidor Central    │ │
│  │  Cliente          │  Header: X-Api-Key: xxx      │  (API Gateway)       │ │
│  │  (App Móvil,      │                              │                      │ │
│  │   Web, Dashboard) │  ◄──────────────────────────  │  • Express.js        │ │
│  │                   │  200 OK + JSON con datos     │  • WebSocket Server  │ │
│  └───────────────────┘                              │  • Caché en RAM      │ │
│                                                     │  • NO tiene SQL      │ │
│                                                     │  • NO tiene creds BD │ │
│                                                     └──────────┬───────────┘ │
│                                                                │             │
│                                                     WebSocket  │             │
│                                                     (ws/wss)   │             │
│                                                                │             │
└────────────────────────────────────────────────────────────────│─────────────┘
                                                                 │
═══════════════════════════════ FIREWALL ═════════════════════════│═════════════
                                                                 │
┌────────────────────────────────────────────────────────────────│─────────────┐
│                          RED LOCAL (On-Premise)                 │             │
│                                                                │             │
│  ┌──────────────────────────────────────────────┐              │             │
│  │                                              │    Conexión  │             │
│  │  Agente On-Premise                           │    SALIENTE  │             │
│  │  (gdata-tunnel-agent)                        │ ◄────────────┘             │
│  │                                              │  (No abre puertos)        │
│  │  • queries.json (lista blanca de SQL)        │                           │
│  │  • config.json (credenciales BD)             │                           │
│  │  • queryResolver.js (validador)              │         ┌────────────────┐│
│  │  • audit.js (trazabilidad)                   │ ──SQL──►│  Base de Datos ││
│  │  • connector.js (multi-motor)                │         │  (SQL Server/  ││
│  │  • drivers/ (mssql, pg, mysql)               │ ◄─datos─│   PG / MySQL)  ││
│  │                                              │         └────────────────┘│
│  └──────────────────────────────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. COMPONENTES DEL SISTEMA

### 5.1 Servidor Central (API Gateway + WebSocket Hub)

**Ubicación en el repositorio:** `/server`
**Versión:** 2.0.0
**Nombre del paquete npm:** `gdata-tunnel-server`

#### 5.1.1 Descripción Funcional

El Servidor Central es un servicio Node.js que combina dos protocolos sobre el mismo puerto TCP:
- **HTTP REST (Express.js):** Para recibir peticiones de las aplicaciones cliente.
- **WebSocket Server (ws):** Para mantener conexiones persistentes con los agentes on-premise.

Su función es **exclusivamente la de intermediario**. No almacena SQL, no conoce credenciales de bases de datos, no procesa datos. Solo recibe peticiones HTTP con un nombre de acción y parámetros, y los reenvía al agente correcto a través del túnel WebSocket.

#### 5.1.2 Archivos del Servidor (Detalle completo)

##### `server/index.js` — Punto de Entrada del Servidor

Este es el archivo principal que arranca todo el servidor. Realiza las siguientes acciones en orden:

1. **Carga variables de entorno** desde el archivo `.env` usando la librería `dotenv`. Esto incluye el puerto (PORT), la API Key (API_KEY) y el timeout de queries (QUERY_TIMEOUT_MS).

2. **Crea la aplicación Express** e instala middlewares globales de seguridad:
   - `helmet()`: Configura cabeceras HTTP de seguridad como X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, entre otras. Protege contra ataques como clickjacking, MIME sniffing, XSS.
   - `cors()`: Permite peticiones cross-origin desde cualquier dominio (necesario para aplicaciones web y móviles que consumen la API desde dominios diferentes).
   - `express.json()`: Parsea automáticamente los cuerpos de las peticiones que llegan en formato JSON.
   - Un middleware de logging que imprime en consola cada petición HTTP entrante con su método y URL.

3. **Monta las rutas de la API:**
   - Aplica el middleware de autenticación por API Key a todas las rutas bajo `/query/*`.
   - Monta las rutas definidas en `routes/api.js` en la raíz del servidor.
   - Define un handler para rutas no encontradas (404) y un error handler global (500).

4. **Crea el servidor HTTP** con `http.createServer(app)` vinculándolo con Express.

5. **Crea el servidor WebSocket** (`WebSocketServer`) montándolo sobre el mismo servidor HTTP en la ruta `/ws`. Configura un payload máximo de 10 MB por mensaje para soportar resultados grandes de consultas.

6. **Inicializa el socket handler** que gestiona las conexiones de los agentes.

7. **Arranca** el servidor en el puerto configurado e imprime la información de inicio en consola.

**Tecnologías usadas:** Node.js, Express.js, ws (WebSocket), dotenv, cors, helmet, http nativo.

##### `server/middleware/apiKey.js` — Middleware de Autenticación HTTP

Este middleware protege todos los endpoints bajo `/query/*` validando que la aplicación cliente envíe la API Key correcta en el header HTTP `X-Api-Key`.

**Funcionamiento paso a paso:**
1. Lee la API Key esperada de la variable de entorno `API_KEY`.
2. Si no se configuró una API Key en el `.env`, **rechaza TODAS las peticiones** con un error 500. Esto es un mecanismo de seguridad fail-secure: si el administrador olvidó configurar la clave, el servidor no queda abierto por accidente.
3. Lee la clave que envió la aplicación cliente en el header `X-Api-Key` de la petición HTTP.
4. Si la clave no existe o no coincide con la esperada, responde con un error 401 (Unauthorized).
5. Si la clave es correcta, permite que la petición continúe al siguiente middleware/ruta.

**Ejemplo de petición válida:**
```
POST /query/empresa_abc HTTP/1.1
Host: servidor.com:3500
X-Api-Key: mi-clave-secreta
Content-Type: application/json

{
  "action": "get_clientes",
  "params": {}
}
```

##### `server/routes/api.js` — Rutas REST de la API

Define tres endpoints principales:

**1. `POST /query/:clienteId`** — Endpoint principal de consultas

Este es el endpoint que las aplicaciones clientes usan para solicitar datos. El flujo completo es:

1. **Extrae el `clienteId`** de la URL (ej. `empresa_abc` de `/query/empresa_abc`).
2. **Extrae `action` y `params`** del body JSON de la petición.
3. **Valida** que se haya enviado un campo `action` (obligatorio). Si no, responde 400 (Bad Request).
4. **Verifica que el agente esté conectado** consultando el registro en memoria (registry). Si el agente no está conectado, responde 502 (Bad Gateway) e incluye la lista de agentes actualmente conectados para ayudar al diagnóstico.
5. **Valida contra el Action Manifest:** Si el agente registró sus acciones disponibles al conectarse, el servidor verifica que la acción solicitada exista en esa lista. Si no existe, responde 404 (Not Found) inmediatamente con la lista de acciones disponibles. Esta validación temprana evita esperar los 30 segundos del timeout por una acción que nunca existió.
6. **Revisa la caché:** Si el TTL de caché está configurado (CACHE_DEFAULT_TTL > 0), busca un resultado previamente cacheado para la misma combinación exacta de clienteId + action + params. Si lo encuentra (cache hit), devuelve el resultado instantáneamente sin molestar al agente.
7. **Crea una correlación:** Genera un UUID v4 único (correlationId) y crea una Promise que quedará "pausada" esperando la respuesta del agente. Registra esta promesa en el mapa de peticiones pendientes (registry.pending) con un timeout configurable (por defecto 30 segundos).
8. **Envía al agente:** A través del WebSocket del agente, envía un mensaje JSON con tipo `query`, el correlationId, el nombre de la acción y los parámetros. **Nota importante: NO envía SQL. Solo el nombre de la acción.**
9. **Espera la respuesta:** Hace `await` sobre la Promise creada. Esta promesa se resolverá cuando el agente envíe su respuesta de vuelta (o se rechazará si el timeout expira).
10. **Guarda en caché** (si está habilitado) y responde al cliente con los datos.

**2. `GET /agents`** — Lista de agentes conectados

Devuelve un JSON con todos los agentes actualmente conectados al servidor, incluyendo sus IDs y la lista de acciones que cada uno soporta. Útil para diagnóstico y para que las aplicaciones cliente sepan qué agentes están disponibles.

**3. `GET /status`** — Estado del servidor

Devuelve estadísticas de monitoreo: número de agentes conectados, número de queries pendientes (en espera de respuesta), detalles de cada agente, y estadísticas de la caché (hits, misses, número de entradas).

##### `server/ws/socketHandler.js` — Manejador de Conexiones WebSocket

Este módulo gestiona todo el ciclo de vida de las conexiones WebSocket de los agentes: conexión, autenticación, comunicación y desconexión.

**Carga inicial:**
- Lee el archivo `agents.json` que contiene el registro de agentes autorizados con sus secrets individuales. Si este archivo no existe, el servidor se apaga con un error fatal.
- Define dos constantes de tiempo:
  - `AUTH_TIMEOUT_MS` = 10 segundos: Tiempo máximo que un agente tiene para autenticarse después de conectarse. Si no se autentica, se le cierra la conexión.
  - `HEARTBEAT_INTERVAL_MS` = 30 segundos: Intervalo de ping/pong para detectar conexiones zombie (agentes que se desconectaron sin avisar por un corte de red).

**Flujo cuando un agente se conecta:**

1. **Registro de la conexión:** Se registra la IP remota del agente, se inicializan variables de estado (clienteId = null, isAuthenticated = false, isAlive = true).

2. **Timer de autenticación:** Se inicia un setTimeout de 10 segundos. Si el agente no se autentica antes de que expire, se le cierra la conexión con código 4000 (Auth timeout).

3. **Heartbeat (ping/pong):** Se inicia un setInterval cada 30 segundos que envía un ping nativo de WebSocket al agente. Si el agente no responde al ping anterior (isAlive sigue siendo false), se asume que la conexión está muerta y se cierra forzosamente con `ws.terminate()`. Cuando el agente responde con un pong, se marca isAlive = true.

4. **Manejo de mensajes:**

   - **`type: 'auth'`** (Autenticación):
     - Verifica que el mensaje incluya `clienteId` y `secret`.
     - Busca el `clienteId` en el archivo `agents.json`. Si no está registrado, responde con error y cierra con código 4003.
     - Compara el `secret` enviado con el registrado para **ese agente específico**. Si no coincide, responde con error y cierra con código 4003.
     - Si todo es correcto: marca isAuthenticated = true, cancela el timer de autenticación, extrae el **Action Manifest** (array de nombres de acciones que el agente soporta) del mensaje, y registra al agente en el registry junto con sus acciones.
     - Envía `authResult` con success = true al agente.

   - **`type: 'queryResult'`** (Respuesta a una consulta):
     - Verifica que el agente esté autenticado.
     - Extrae el `correlationId`, `data` y `error` del mensaje.
     - Llama a `registry.resolvePending(correlationId, ...)` que despierta la Promise pausada en api.js, pasándole los datos o el error.

   - **`type: 'pong'`** (Heartbeat de capa aplicación):
     - Marca isAlive = true. Es un fallback para clientes WebSocket que no soportan el ping/pong nativo del protocolo.

5. **Desconexión:** Cuando el socket se cierra, se limpian los timers (auth y ping) y se desregistra al agente del registry.

##### `server/lib/registry.js` — Registro Central de Agentes y Correlaciones

Este módulo mantiene tres estructuras de datos fundamentales en la memoria RAM del servidor:

1. **`agents`** (Map<string, WebSocket>): Mapea cada `clienteId` a su conexión WebSocket activa. Permite localizar rápidamente a un agente para enviarle mensajes.

2. **`agentActions`** (Map<string, string[]>): Mapea cada `clienteId` a un array de nombres de acciones que el agente declaró como disponibles al autenticarse. Esto permite validar peticiones antes de enviarlas al agente.

3. **`pending`** (Map<string, {resolve, reject, timer}>): Mapea cada `correlationId` (UUID) a las funciones resolve/reject de una Promise y su timer de timeout. Este es el mecanismo que vincula una petición HTTP entrante con la respuesta que eventualmente llegará del agente por WebSocket.

**Funciones principales:**

- `registerAgent(clienteId, ws, actions)`: Registra un agente. Si ya existía uno con el mismo ID (reconexión rápida), cierra la conexión anterior.
- `unregisterAgent(clienteId, ws)`: Elimina un agente del registro. Verifica que el socket que se desregistra sea el mismo que está registrado (evita que una desconexión tardía borre la nueva conexión).
- `getAgent(clienteId)`: Devuelve el WebSocket activo de un agente, o null si no está conectado o su socket se cerró.
- `listAgents()`: Devuelve un array con los IDs de todos los agentes conectados.
- `getAgentActions(clienteId)`: Devuelve las acciones disponibles de un agente específico.
- `createPending(timeoutMs)`: Crea una Promise "pausable" con un UUID y un timeout. Retorna el `{correlationId, promise}` para que api.js pueda enviar el correlationId al agente y hacer `await promise`.
- `resolvePending(correlationId, data, isError)`: Resuelve (o rechaza) la Promise asociada a un correlationId cuando llega la respuesta del agente. Cancela el timer de timeout y libera la memoria.
- `stats()`: Devuelve estadísticas para el endpoint `/status`.

##### `server/lib/cache.js` — Sistema de Caché en Memoria

Implementa una caché en memoria RAM usando la librería `node-cache` para evitar consultas repetidas al agente.

**Funcionamiento:**
- Genera llaves de caché deterministas basadas en `clienteId::action::params_ordenados_JSON`.
- Los parámetros se ordenan alfabéticamente antes de serializar, para que `{a:1, b:2}` y `{b:2, a:1}` generen la misma llave.
- El TTL (Time-To-Live) se configura con la variable de entorno `CACHE_DEFAULT_TTL` (en segundos). Por defecto es 0 (sin caché).
- `node-cache` barre y elimina entradas expiradas automáticamente cada 60 segundos.
- La caché se almacena por referencia (`useClones: false`) para mejor rendimiento.
- Límite máximo de 1000 entradas simultáneas (`maxKeys: 1000`) para proteger la memoria RAM del servidor contra crecimiento descontrolado (OOM).
- Protección de payload: las respuestas que superen 1 MB no se almacenan en caché para evitar que un único resultado masivo sature el heap de Node.js.
- Incluye función de invalidación por cliente para limpiar la caché cuando es necesario.

#### 5.1.3 Archivos de Configuración del Servidor

##### `server/.env` (Generado por el instalador, no está en el repositorio)
```
PORT=3500
API_KEY=mi-clave-de-api-super-segura-cambiar-en-produccion
QUERY_TIMEOUT_MS=30000
# CACHE_DEFAULT_TTL=60
```
- `PORT`: Puerto TCP donde escucha el servidor (HTTP y WebSocket comparten el mismo puerto).
- `API_KEY`: Clave que deben enviar las aplicaciones clientes en el header X-Api-Key para autenticarse.
- `QUERY_TIMEOUT_MS`: Tiempo máximo de espera (en milisegundos) por la respuesta de un agente antes de devolver un error 504 Gateway Timeout.
- `CACHE_DEFAULT_TTL`: (Opcional) Tiempo de vida en segundos de las entradas en caché. Si es 0 o no está definido, la caché está desactivada.

##### `server/agents.json` (Generado por el instalador, no está en el repositorio)
```json
{
  "empresa_ejemplo": {
    "secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "description": "Cliente principal - Base de Datos SQL Server Local"
  },
  "sucursal_norte": {
    "secret": "q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
    "description": "Sucursal Norte - Servidor de Ventas MySQL"
  }
}
```
- La clave del objeto (`empresa_ejemplo`) es el `clienteId` que usará el agente para identificarse.
- `secret`: Contraseña única para validar la conexión WebSocket de ese agente específico.
- `description`: Campo informativo para el administrador.

#### 5.1.4 Dependencias del Servidor

| Librería | Versión | Propósito |
|----------|---------|-----------|
| `express` | ^4.21.2 | Framework HTTP para la API REST |
| `compression` | ^1.8.0 | Compresión GZIP de respuestas HTTP (~90% de reducción) |
| `ws` | ^8.18.1 | Servidor WebSocket (RFC 6455) con `perMessageDeflate` |
| `dotenv` | ^16.4.7 | Cargar variables de entorno desde .env |
| `cors` | ^2.8.5 | Permitir peticiones cross-origin |
| `helmet` | ^8.0.0 | Cabeceras de seguridad HTTP |
| `node-cache` | ^5.1.2 | Caché en memoria RAM (maxKeys: 1000, protección 1 MB) |
| `uuid` | ^11.1.0 | Generación de UUIDs v4 para correlación |

---

### 5.2 Agente On-Premise (Cliente del Túnel Inverso)

**Ubicación en el repositorio:** `/agent`
**Versión:** 2.0.0
**Nombre del paquete npm:** `gdata-tunnel-agent`

#### 5.2.1 Descripción Funcional

El Agente es el componente más crítico del sistema. Es el único que tiene acceso real a los datos. Se instala dentro de la red corporativa de la empresa y realiza las siguientes funciones:

1. **Inicia una conexión WebSocket de salida** hacia el servidor central (no abre puertos).
2. **Se autentica** enviando su clienteId, secret y la lista de acciones que soporta (Action Manifest).
3. **Escucha solicitudes** del servidor: nombres de acciones y parámetros.
4. **Resuelve las acciones** buscando en su archivo local `queries.json` la sentencia SQL correspondiente.
5. **Valida los parámetros** (requeridos y tipos) antes de ejecutar.
6. **Verifica el modo solo-lectura** si está activado.
7. **Ejecuta la consulta SQL** contra la base de datos local.
8. **Registra la actividad** en archivos de auditoría locales.
9. **Devuelve los resultados** al servidor central por WebSocket.
10. **Se reconecta automáticamente** si se pierde la conexión.

#### 5.2.2 Archivos del Agente (Detalle completo)

##### `agent/index.js` — Punto de Entrada del Agente

**Carga inicial:**
1. Importa los módulos: `ws` (WebSocket), `connector` (ejecutor de queries), `queryResolver` (resolvedor de acciones), `audit` (auditoría).
2. Lee `config.json` con la configuración completa del agente.
3. Desestructura la configuración: `clienteId`, `serverUrl`, `agentSecret`, `readOnly`, `dbEngine`, `reconnect` (parámetros de reconexión), y `dbConfig` (credenciales de BD).

**Función `connect()`:**
1. Crea una nueva conexión WebSocket hacia `serverUrl`.
2. **On open:** Envía el mensaje de autenticación con `type: 'auth'`, `clienteId`, `secret`, y `actions` (la lista de nombres de acciones obtenida de `queryResolver.getAvailableActions()`).
3. **On message:** Parsea el JSON. Si es `authResult`, verifica si la autenticación fue exitosa o fallida (si falló, se marca isShuttingDown = true para no reconectar). Si es `query`, llama a `handleQuery()`. Si es `error`, lo muestra en consola.
4. **On close:** Llama a `scheduleReconnect()`.
5. **On error:** Muestra el error en consola.
6. **On ping:** Responde automáticamente con `ws.pong()` (heartbeat).

**Función `handleQuery(msg)`:**

Esta es la función central del agente que procesa cada solicitud de consulta. El flujo es:

1. Extrae `correlationId`, `action` y `params` del mensaje recibido.
2. **Resolución de la acción:** Llama a `queryResolver.resolve(action, params, readOnly)`:
   - Si la acción no existe en queries.json → error.
   - Si falta un parámetro requerido → error.
   - Si un parámetro tiene tipo incorrecto → error.
   - Si readOnly es true y el SQL contiene palabras clave de escritura → error.
   - Si todo es válido → devuelve el SQL, los parámetros validados y los tipos.
3. **Ejecución de la query:** Llama a `connector.executeQuery(dbEngine, dbConfig, sql, params, paramTypes)`.
4. **Auditoría:** Registra la acción, parámetros, estado (OK/ERROR), filas devueltas y tiempo de ejecución con `audit.log()`.
5. **Respuesta:** Envía el resultado (o el error) de vuelta al servidor con `type: 'queryResult'` y el mismo `correlationId`.

**Función `scheduleReconnect()`:**

Implementa **reconexión con backoff exponencial**:
- Primera vez: espera 1 segundo.
- Segunda vez: espera 2 segundos.
- Tercera vez: espera 4 segundos.
- Cuarta vez: espera 8 segundos.
- Y así sucesivamente hasta un máximo de 30 segundos.
- Cuando se reconecta exitosamente, el delay vuelve a 1 segundo.

**Función `shutdown(signal)`:**

Maneja el cierre limpio del agente cuando recibe señales del sistema operativo (SIGINT = Ctrl+C, SIGTERM = cierre por el sistema o PM2). Cierra el WebSocket con código 1000 (normal closure) y cierra el pool de conexiones de base de datos.

##### `agent/lib/queryResolver.js` — Resolvedor de Queries (Lista Blanca)

Este módulo es el **corazón de la seguridad del agente**. Su responsabilidad es:

1. **Cargar la lista blanca** de queries desde `queries.json` al iniciar. Si el archivo no existe, el agente se apaga con error fatal (process.exit(1)). Elimina el campo `_comentario` si existe.

2. **Verificar modo solo-lectura:** Usa una expresión regular para detectar palabras clave de escritura SQL: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `EXEC`, `EXECUTE`, `MERGE`, `GRANT`, `REVOKE`. Si `readOnly` es true y la query contiene alguna de estas palabras, la rechaza.

3. **Validar parámetros:** Para cada parámetro definido en la query:
   - Verifica si es `required` y no fue enviado → error.
   - Verifica el tipo usando el mapa `TYPE_VALIDATORS`:
     - `int`: Verifica que sea un entero finito.
     - `string` / `varchar`: Acepta strings y números.
     - `float`: Verifica que sea un número finito.
     - `decimal`: Igual que float.
     - `boolean`: Acepta boolean, 0, 1, "0", "1", "true", "false".
     - `bit`: Acepta boolean, 0, 1, "0", "1".
     - `date`: Verifica que `Date.parse()` no devuelva NaN.
     - `datetime`: Igual que date.

4. **Devolver el SQL resuelto:** Si todo pasa la validación, devuelve `{ success: true, sql, params, paramTypes }` donde `paramTypes` contiene los tipos SQL nativos para cada driver de base de datos.

5. **Función `getAvailableActions()`:** Devuelve un array con los nombres de todas las acciones definidas en queries.json. Este array se envía al servidor como "Action Manifest" durante la autenticación.

##### `agent/lib/audit.js` — Módulo de Auditoría

Registra cada acción ejecutada en archivos de texto plano, creando un **log de acceso diario**. Cada línea tiene el formato:

```
[2026-01-15 14:32:05] ACTION: get_clientes | PARAMS: {"IdCliente":"005"} | STATUS: OK | ROWS: 15 | TIME: 23ms
[2026-01-15 14:32:10] ACTION: get_productos | PARAMS: {} | STATUS: OK | ROWS: 1247 | TIME: 156ms
[2026-01-15 14:33:01] ACTION: accion_inexistente | PARAMS: {} | STATUS: ERROR | ERROR: Acción desconocida | TIME: 0ms
```

- Los archivos se guardan en `agent/logs/` con el nombre `audit_YYYY-MM-DD.log`.
- Se crea un archivo nuevo cada día.
- Si el directorio `logs/` no existe, se crea automáticamente.
- Si el módulo de auditoría falla por cualquier razón (disco lleno, permisos, etc.), el error se muestra en consola pero **no se detiene el agente**. La auditoría es tolerante a fallos.

##### `agent/db/connector.js` — Factory de Conexión Multi-Motor

Este módulo implementa el **patrón de diseño Factory** para abstraer las diferencias entre motores de base de datos.

**Funcionamiento:**
1. Mantiene un mapa de factories lazy: `{ mssql: () => require('./drivers/mssqlDriver'), postgres: () => require('./drivers/pgDriver'), mysql: () => require('./drivers/mysqlDriver') }`.
2. Solo carga en memoria el driver que realmente se necesita (lazy loading). Si el agente usa SQL Server, nunca se cargan los drivers de PostgreSQL ni MySQL.
3. Expone dos funciones con interfaz unificada:
   - `executeQuery(engine, dbConfig, sql, params, paramTypes)`: Delega al driver correcto.
   - `closePool()`: Cierra el pool de conexiones del driver activo.

##### `agent/db/drivers/mssqlDriver.js` — Driver para Microsoft SQL Server

- Usa la librería `mssql` (oficial de Microsoft/tediousjs).
- Implementa **Connection Pooling**: mantiene entre 2 y 10 conexiones abiertas reutilizables.
- Los parámetros se pasan con `request.input(nombre, tipo, valor)` usando la sintaxis nativa `@NombreParametro` de SQL Server. Esto **previene inyección SQL** por diseño.
- Si el queryResolver proporciona tipos de parámetros, se usa `request.input(nombre, sql.Int, valor)` para mayor precisión. Si no hay tipo definido, mssql infiere el tipo automáticamente.
- Maneja la pérdida de conexión del pool: si SQL Server se reinicia, el pool se recrea automáticamente en la siguiente consulta.
- Tipos SQL soportados: `Int`, `NVarChar`, `Float`, `Decimal(18,4)`, `Bit`, `Date`, `DateTime`.

##### `agent/db/drivers/pgDriver.js` — Driver para PostgreSQL

- Usa la librería `pg` (node-postgres).
- Implementa **Connection Pooling** con hasta 10 conexiones.
- **Conversión automática de sintaxis de parámetros:** Las queries en queries.json usan `@NombreParametro` (sintaxis de SQL Server por convención del proyecto). PostgreSQL usa `$1, $2, $3...` (sintaxis posicional). El driver convierte automáticamente `@IdCliente` → `$1`, `@Activo` → `$2`, etc., y arma el array de valores en el orden correcto de aparición.
- Devuelve los resultados en el mismo formato que el driver de MSSQL (`{ recordset, recordsets, rowsAffected }`) para mantener la consistencia de la interfaz.

##### `agent/db/drivers/mysqlDriver.js` — Driver para MySQL / MariaDB

- Usa la librería `mysql2` con el módulo de Promises (`mysql2/promise`).
- Implementa **Connection Pooling** con hasta 10 conexiones.
- **Conversión automática de sintaxis de parámetros:** Convierte `@NombreParametro` → `?` (marcadores posicionales de MySQL) y arma el array de valores en el orden correcto. A diferencia de PostgreSQL, si un parámetro aparece múltiples veces en la misma query, se agrega al array de valores cada vez.
- Maneja tanto resultados de SELECT (array de objetos) como resultados de INSERT/UPDATE (ResultSetHeader con affectedRows).
- Devuelve los resultados en el mismo formato unificado.

#### 5.2.3 Archivo de Lista Blanca: `agent/queries.json`

Este archivo es el núcleo de la seguridad del agente. Define exactamente qué consultas SQL pueden ejecutarse. El servidor externo **nunca puede enviar SQL arbitrario**; solo puede solicitar la clave de una acción configurada en este archivo.

**Estructura de cada acción:**
```json
{
  "nombre_de_la_accion": {
    "description": "Descripción legible de lo que hace esta query",
    "sql": "SELECT ... FROM ... WHERE campo = @NombreParametro",
    "params": {
      "NombreParametro": {
        "type": "string",
        "required": true
      }
    }
  }
}
```

**Ejemplo real del proyecto (queries.json completo):**
```json
{
  "get_cuentas_cobrar_by_client": {
    "description": "Obtiene cuentas por cobrar de un cliente específico, filtrando solo las que tienen saldo pendiente mayor a 0.01",
    "sql": "SELECT IdCliente as IDCliente, Id as IDDocumento, IdVendedor as IDVendedor, NroDocumt as nro_documento, Tipo as tipo_documento, SaldoAct as saldo_pendiente, AutoIncrField as auto_increment, Factor as tasa_cambio, FORMAT(FEmision, 'dd/MM/yyyy') as emision, FORMAT(FVenc, 'dd/MM/yyyy') as vence FROM CtsxCobrar WHERE IdCliente = @IdCliente AND SaldoAct > 0.01",
    "params": {
      "IdCliente": { "type": "string", "required": true }
    }
  },
  "get_bancos": {
    "description": "Obtiene todos los bancos registrados en el sistema con su moneda asociada",
    "sql": "SELECT idbanco as IDBanco, Descripcion as banco, id_moneda as IDMoneda FROM fBancos",
    "params": {}
  },
  "get_clientes": {
    "description": "Obtiene la lista completa de clientes con toda su información comercial",
    "sql": "SELECT Codigo as IDCliente, Descripcion as razon_social, Direccion1 as direccion, Telefonos as telefono, IdVendedor as IDVendedor, TipoPrecio as tipo_precio, Rif as rif, PermiteCredito as tiene_credito, LimiteCredito as limite_credito, DiasCredito as dias_credito, Contact as contacto, Email as email, Descto as descuento, NumeroUV as nro_ultimo_venta, FORMAT(FechaUV, 'dd/MM/yyyy') as fecha_ultima, NumeroUP as nro_ultimo_pago, FORMAT(FechaUP, 'dd/MM/yyyy') as fecha_ultimo_pago FROM Clientes",
    "params": {}
  },
  "get_productos": {
    "description": "Obtiene el catálogo completo de productos con todos los niveles de precio, impuestos y datos de referencia",
    "sql": "SELECT Codigo as IDProducto, Departamento as IDDepartamento, Descripcion1 as Descripcion, Precio_Maximo as precio_maximo, Precio_Minimo as precio_minimo, Precio_Mayor as precio_mayor, Precio_Detal as precio_detal, Precio_Oferta as precio_oferta, Exento as EsExento, Impuesto as tasa_iva, Refere as referencia, Marca as marca, Modelo as modelo, FORMAT(FechaUV, 'dd/MM/yyyy') as fecha_ult_venta, IDMoneda as IDMoneda FROM INVENTARIO",
    "params": {}
  },
  "get_empresa": {
    "description": "Obtiene los datos de configuración de la empresa",
    "sql": "SELECT NombreEmpresa as razon_social, Direccion1 as direccion_fiscal, Fiscal1 as rif, Telefonos as telefono_empresa, EMail as email_principal FROM Configuracion",
    "params": {}
  },
  "get_monedas": {
    "description": "Obtiene todas las monedas configuradas en el sistema",
    "sql": "SELECT Codigo as IDMoneda, Descripcion as nombre_moneda, Simbol as simbolo_moneda, ParaVenta as tasa_cambio FROM Monedas",
    "params": {}
  }
}
```

#### 5.2.4 Archivo de Configuración del Agente: `agent/config.json`

```json
{
  "clienteId": "empresa_ejemplo",
  "serverUrl": "wss://mi-servidor.com/ws",
  "agentSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "readOnly": true,
  "reconnect": {
    "initialDelayMs": 1000,
    "maxDelayMs": 30000,
    "backoffMultiplier": 2
  },
  "dbEngine": "mssql",
  "db": {
    "server": "localhost",
    "port": 1433,
    "database": "MiBaseDeDatos",
    "user": "sa",
    "password": "MiPasswordSeguro123",
    "options": {
      "encrypt": false,
      "trustServerCertificate": true,
      "requestTimeout": 30000,
      "connectionTimeout": 15000
    }
  }
}
```

**Descripción de cada campo:**
- `clienteId`: Identificador único de este agente. Debe coincidir con una clave en el `agents.json` del servidor.
- `serverUrl`: URL completa del servidor central. Usa `ws://` para desarrollo o `wss://` para producción con SSL.
- `agentSecret`: Contraseña secreta que debe coincidir con el secret registrado en el servidor para este clienteId.
- `readOnly`: Si es `true`, cualquier query que contenga INSERT, UPDATE, DELETE, DROP, etc., será rechazada automáticamente por el agente.
- `reconnect.initialDelayMs`: Tiempo de espera inicial antes del primer intento de reconexión (1 segundo).
- `reconnect.maxDelayMs`: Tiempo máximo de espera entre reconexiones (30 segundos).
- `reconnect.backoffMultiplier`: Factor multiplicador del backoff exponencial (2 = duplica el tiempo cada vez).
- `dbEngine`: Motor de base de datos. Valores válidos: `"mssql"`, `"postgres"`, `"mysql"`.
- `db`: Objeto con las credenciales de conexión a la base de datos local.

#### 5.2.5 Dependencias del Agente

| Librería | Versión | Propósito |
|----------|---------|-----------|
| `ws` | ^8.18.1 | Cliente WebSocket (conexión al servidor) |
| `mssql` | ^11.0.1 | Driver oficial para Microsoft SQL Server |
| `pg` | ^8.13.1 | Driver para PostgreSQL (node-postgres) |
| `mysql2` | ^3.11.5 | Driver para MySQL/MariaDB con Promises |
| `dotenv` | ^16.4.7 | Cargar variables de entorno |

---

### 5.3 Landing Page (Sitio Web de Presentación)

**Ubicación en el repositorio:** `/landing`
**Tecnologías:** React 19 + Vite + CSS vanilla
**Despliegue:** Vercel (configurado en `vercel.json`)

La landing page es un sitio web interactivo y estático construido con React y Vite que presenta el proyecto AgentStructure de forma visual y atractiva. Sirve como material de presentación académica del proyecto.

**Componentes React:**
- `Navbar.jsx` / `Navbar.css`: Barra de navegación superior con el logo y enlaces internos.
- `Hero.jsx` / `Hero.css`: Sección héroe principal con el título, la descripción y las llamadas a la acción.
- `Architecture.jsx` / `Architecture.css`: Sección que muestra el diagrama de arquitectura del sistema de forma visual.
- `Features.jsx` / `Features.css`: Sección de características destacadas del proyecto con iconos y descripciones.
- `InstallSection.jsx` / `InstallSection.css`: Sección con instrucciones paso a paso de instalación.
- `Footer.jsx` / `Footer.css`: Pie de página con información de contacto y créditos.

**Configuración de despliegue (vercel.json):**
```json
{
  "version": 2,
  "buildCommand": "cd landing && npm install && npm run build",
  "outputDirectory": "landing/dist",
  "installCommand": ""
}
```

---

### 5.4 Instalador de Windows (Aplicación de Escritorio)

**Ubicación en el repositorio:** `/windows-installer`
**Tecnologías:** Electron 28 + HTML/CSS/JS vanilla + electron-builder
**Formato de salida:** Ejecutable portable (.exe) con privilegios de administrador

El instalador es una aplicación de escritorio gráfica construida con Electron que simplifica la instalación del agente o del servidor como un **servicio de Windows** (Windows Service). Esto permite que el agente o el servidor se ejecuten en segundo plano automáticamente cada vez que Windows se enciende, sin necesidad de que un usuario inicie sesión.

**Características:**
- Interfaz gráfica tipo wizard (asistente paso a paso).
- Selección del componente a instalar (Agente o Servidor).
- Formularios de configuración para ingresar todos los datos necesarios.
- Copia automática de archivos de plantilla desde los directorios del proyecto.
- Generación automática de archivos de configuración.
- Instalación de dependencias de Node.js (npm install).
- Registro e inicio del servicio de Windows usando WinSW (Windows Service Wrapper).
- Soporte para múltiples agentes con nombres de servicio dinámicos basados en el `clienteId`.
- Detención y desinstalación automática del servicio anterior al sobrescribir.

**Archivos principales:**
- `main.js`: Proceso principal de Electron. Gestiona la ventana, los permisos de administrador, la copia de archivos, la instalación de npm, y el registro/arranque del servicio de Windows.
- `index.html`: Interfaz HTML del wizard con los formularios de configuración.
- `style.css`: Estilos CSS de la interfaz gráfica.
- `renderer.js`: Lógica del frontend (validación de formularios, navegación entre pasos, comunicación con el proceso principal vía IPC).
- `bin/`: Directorio que contiene el ejecutable WinSW (Windows Service Wrapper) para gestionar servicios de Windows.
- `scripts/download-winsw.js`: Script postinstall que descarga automáticamente WinSW desde GitHub.

**Flujo de instalación del wizard:**
1. El usuario elige entre "Agente On-Premise" o "Servidor Central".
2. Completa el formulario de configuración correspondiente.
3. El instalador copia los archivos base desde la plantilla incluida en el .exe.
4. Genera los archivos de configuración (config.json, .env, agents.json).
5. Ejecuta `npm install` para instalar las dependencias de Node.js.
6. Si existe un servicio previo con el mismo nombre, lo detiene y desinstala.
7. Genera el archivo XML de configuración de WinSW con el nombre del servicio dinámico.
8. Registra e inicia el nuevo servicio de Windows.
9. Muestra la pantalla de éxito con instrucciones.

---

### 5.5 Script de Instalación por Terminal (install.js)

**Ubicación en el repositorio:** `install.js` (raíz del proyecto)
**Tecnologías:** Node.js puro (sin dependencias externas)

Script de instalación interactivo por terminal compatible con Windows, Linux y macOS. Es una alternativa al instalador gráfico de Windows para entornos donde no se requiere un servicio del sistema operativo o donde se prefiere la configuración manual.

**Flujo del script:**
1. Muestra un banner decorativo con colores ANSI.
2. Pregunta si quiere instalar el Agente (opción 1) o el Servidor (opción 2).
3. **Si elige Agente:** Solicita clienteId, URL del servidor, secret, modo solo-lectura, motor de BD, y credenciales de BD. Genera `agent/config.json` y ejecuta `npm install` en la carpeta `agent/`.
4. **Si elige Servidor:** Solicita puerto, API Key (puede generar una automáticamente con crypto.randomBytes), timeout, y permite registrar múltiples agentes con sus secrets. Genera `server/.env` y `server/agents.json`, y ejecuta `npm install` en la carpeta `server/`.

---

## 6. FLUJO DE DATOS COMPLETO (De extremo a extremo)

Este es el recorrido completo de una solicitud de datos desde que una aplicación cliente la envía hasta que recibe la respuesta:

### Paso 1: La Aplicación envía una petición HTTP
```
POST https://mi-servidor.com:3500/query/empresa_abc
Headers: { "X-Api-Key": "mi-clave-secreta", "Content-Type": "application/json" }
Body: { "action": "get_clientes", "params": {} }
```

### Paso 2: El Servidor recibe la petición
- El middleware `apiKey.js` valida el header X-Api-Key → OK.
- La ruta `POST /query/:clienteId` extrae `clienteId = "empresa_abc"`, `action = "get_clientes"`, `params = {}`.

### Paso 3: El Servidor valida la petición
- Verifica que el agente "empresa_abc" esté conectado → SÍ (está en el registry).
- Verifica que la acción "get_clientes" esté en el Action Manifest del agente → SÍ.
- Verifica la caché → MISS (no hay resultado previo).

### Paso 4: El Servidor crea una correlación
- Genera un UUID: `"a1b2c3d4-5678-90ab-cdef-1234567890ab"`.
- Crea una Promise que queda "pausada" esperando la respuesta.
- Registra la promesa en el mapa `pending` con un timeout de 30 segundos.

### Paso 5: El Servidor reenvía al Agente por WebSocket
```json
{
  "type": "query",
  "correlationId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "action": "get_clientes",
  "params": {}
}
```
**Nota: NO se envía SQL. Solo el nombre de la acción.**

### Paso 6: El Agente recibe la solicitud
- Parsea el mensaje JSON.
- Identifica `type: 'query'` → llama a `handleQuery()`.

### Paso 7: El Agente resuelve la acción (queryResolver)
- Busca `"get_clientes"` en queries.json → ENCONTRADA.
- SQL: `"SELECT Codigo as IDCliente, Descripcion as razon_social, ... FROM Clientes"`.
- Verifica modo solo-lectura → es un SELECT, OK (no tiene INSERT/UPDATE/DELETE).
- Valida parámetros → `params: {}` está vacío y la query no requiere parámetros, OK.

### Paso 8: El Agente ejecuta la query (connector)
- El connector identifica `dbEngine = "mssql"` → carga `mssqlDriver.js`.
- El driver obtiene (o reutiliza) el pool de conexiones.
- Crea un `request`, asigna los parámetros (ninguno en este caso), y ejecuta la query.
- SQL Server devuelve 250 filas de clientes.

### Paso 9: El Agente registra en auditoría
```
[2026-01-15 14:32:05] ACTION: get_clientes | PARAMS: {} | STATUS: OK | ROWS: 250 | TIME: 45ms
```

### Paso 10: El Agente envía la respuesta al Servidor por WebSocket
```json
{
  "type": "queryResult",
  "correlationId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "data": {
    "recordset": [
      { "IDCliente": "001", "razon_social": "Empresa ABC", ... },
      { "IDCliente": "002", "razon_social": "Distribuidora XYZ", ... },
      ...
    ],
    "rowsAffected": [250]
  }
}
```

### Paso 11: El Servidor resuelve la correlación
- El `socketHandler` recibe el `queryResult` con el `correlationId`.
- Llama a `registry.resolvePending()` que despierta la Promise que estaba pausada en `api.js`.
- Cancela el timer de timeout.

### Paso 12: El Servidor responde a la Aplicación
```json
{
  "ok": true,
  "fromCache": false,
  "data": {
    "recordset": [
      { "IDCliente": "001", "razon_social": "Empresa ABC", ... },
      ...
    ],
    "rowsAffected": [250]
  }
}
```

### Paso 13: (Opcional) El Servidor guarda en caché
Si `CACHE_DEFAULT_TTL > 0`, guarda el resultado con la llave `"empresa_abc::get_clientes::{}"` para que la próxima petición idéntica se sirva instantáneamente.

---

## 7. MODELO DE SEGURIDAD (Detallado)

### 7.1 Capa 1: Autenticación HTTP (App → Servidor)

- **Mecanismo:** API Key en el header `X-Api-Key`.
- **Propósito:** Evitar que cualquier persona con la URL pueda consultar datos.
- **Fail-secure:** Si no se configura API_KEY en el .env, TODAS las peticiones son rechazadas.
- **Scope:** Protege todos los endpoints bajo `/query/*`.

### 7.2 Capa 2: Autenticación WebSocket (Agente → Servidor)

- **Mecanismo:** Secret único por agente, validado contra `agents.json`.
- **Propósito:** Garantizar que solo agentes autorizados puedan conectarse.
- **Timeout:** Si un agente no se autentica en 10 segundos, se le desconecta.
- **Aislamiento:** Si se compromete el secret de un agente, los demás siguen seguros.

### 7.3 Capa 3: Lista Blanca de Queries (queries.json)

- **Mecanismo:** Solo las acciones definidas en queries.json pueden ejecutarse. El servidor nunca envía SQL.
- **Propósito:** La empresa tiene control total sobre qué datos se exponen.
- **Protección:** Incluso si un atacante compromete el servidor central, no puede ejecutar SQL arbitrario contra la base de datos.

### 7.4 Capa 4: Validación de Tipos de Parámetros

- **Mecanismo:** Cada parámetro se valida por tipo (int, string, float, etc.) antes de ejecutar la query.
- **Propósito:** Prevenir inyección SQL y garantizar integridad de datos.
- **Tipos soportados:** int, string, varchar, float, decimal, boolean, bit, date, datetime.

### 7.5 Capa 5: Queries Parametrizadas (Anti SQL-Injection)

- **Mecanismo:** Todos los drivers usan queries parametrizadas nativas del motor de BD:
  - MSSQL: `request.input('nombre', tipo, valor)` con sintaxis `@NombreParametro`.
  - PostgreSQL: `pool.query(sql, valuesArray)` con sintaxis `$1, $2, $3`.
  - MySQL: `pool.query(sql, valuesArray)` con sintaxis `?`.
- **Propósito:** El SQL y los datos nunca se concatenan. Los valores siempre se pasan como parámetros separados al motor de BD, lo que hace imposible la inyección SQL por diseño.

### 7.6 Capa 6: Modo Solo-Lectura

- **Mecanismo:** Si `readOnly: true` en config.json, el queryResolver rechaza cualquier SQL que contenga INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, EXECUTE, MERGE, GRANT, REVOKE.
- **Propósito:** Garantizar por contrato que el sistema es de solo lectura, independientemente de lo que diga queries.json.

### 7.7 Capa 7: Cabeceras HTTP de Seguridad (Helmet)

- **Mecanismo:** El middleware `helmet()` configura automáticamente cabeceras HTTP protectoras:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Strict-Transport-Security`
  - `X-XSS-Protection`
  - Y otras.
- **Propósito:** Proteger contra ataques comunes como clickjacking, MIME sniffing, XSS.

### 7.8 Capa 8: Heartbeat y Detección de Conexiones Zombie

- **Mecanismo:** Ping/pong cada 30 segundos. Si el agente no responde, se desconecta forzosamente.
- **Propósito:** Detectar y limpiar conexiones muertas por cortes de red silenciosos.

### 7.9 Capa 9: No Exposición de Credenciales

- Los archivos sensibles (.env, agents.json, config.json) están en `.gitignore` y nunca se suben al repositorio.
- Solo existen archivos `.example` con valores ficticios como guía.
- El servidor central NUNCA conoce ni almacena credenciales de bases de datos.

---

## 8. PATRONES DE DISEÑO IMPLEMENTADOS

### 8.1 Factory Pattern (connector.js)
**Dónde:** `agent/db/connector.js`
**Qué hace:** Selecciona automáticamente el driver de base de datos correcto según la configuración, exponiendo una interfaz unificada (`executeQuery`, `closePool`) independiente del motor.

### 8.2 Broker / Mediator Pattern (Servidor Central)
**Dónde:** Todo el directorio `server/`
**Qué hace:** El servidor actúa como intermediario (broker) entre las aplicaciones cliente y los agentes. No procesa datos, solo enruta mensajes entre ambos.

### 8.3 Registry Pattern (registry.js)
**Dónde:** `server/lib/registry.js`
**Qué hace:** Mantiene un registro centralizado de agentes conectados, sus capacidades (actions) y las peticiones pendientes. Permite buscar y gestionar agentes por ID.

### 8.4 Correlation ID Pattern (registry.js + api.js + socketHandler.js)
**Dónde:** Flujo de peticiones HTTP → WebSocket → HTTP
**Qué hace:** Usa UUIDs únicos para vincular una petición HTTP entrante con la respuesta que eventualmente llega del agente por WebSocket. Permite que múltiples peticiones estén "en vuelo" simultáneamente sin confundir las respuestas.

### 8.5 Middleware Pipeline Pattern (Express)
**Dónde:** `server/index.js`, `server/middleware/apiKey.js`
**Qué hace:** Las peticiones HTTP pasan por una cadena de middlewares (helmet → cors → json → logging → apiKeyAuth → ruta) donde cada uno agrega funcionalidad de forma modular.

### 8.6 Connection Pool Pattern (drivers)
**Dónde:** Los tres drivers de BD (`mssqlDriver.js`, `pgDriver.js`, `mysqlDriver.js`)
**Qué hace:** Mantiene un grupo de conexiones de BD abiertas y reutilizables, evitando el costo de crear y destruir conexiones por cada query.

### 8.7 Whitelist / Allow-list Pattern (queryResolver.js)
**Dónde:** `agent/lib/queryResolver.js`
**Qué hace:** Solo permite la ejecución de acciones explícitamente definidas en queries.json. Todo lo que no está en la lista es rechazado.

### 8.8 Exponential Backoff Pattern (index.js del agente)
**Dónde:** `agent/index.js`, función `scheduleReconnect()`
**Qué hace:** Aumenta progresivamente el tiempo de espera entre reconexiones fallidas (1s → 2s → 4s → 8s... hasta 30s) para evitar saturar el servidor o la red.

---

## 9. TECNOLOGÍAS Y DEPENDENCIAS UTILIZADAS

### 9.1 Plataforma Base
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Node.js** | v18+ | Runtime de JavaScript del lado del servidor |
| **npm** | v9+ | Gestor de paquetes |
| **JavaScript (ES2020+)** | — | Lenguaje de programación principal |

### 9.2 Servidor Central
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Express.js** | ^4.21.2 | Framework web para API REST |
| **compression** | ^1.8.0 | Compresión GZIP de respuestas HTTP (~90% de reducción) |
| **ws** | ^8.18.1 | Implementación de WebSocket para Node.js (RFC 6455) con `perMessageDeflate` |
| **dotenv** | ^16.4.7 | Gestión de variables de entorno |
| **cors** | ^2.8.5 | Middleware de Cross-Origin Resource Sharing |
| **helmet** | ^8.0.0 | Cabeceras de seguridad HTTP |
| **node-cache** | ^5.1.2 | Almacenamiento en caché en memoria (maxKeys: 1000, protección 1 MB) |
| **uuid** | ^11.1.0 | Generación de UUIDs v4 |

### 9.3 Agente On-Premise
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **ws** | ^8.18.1 | Cliente WebSocket |
| **mssql** | ^11.0.1 | Driver para Microsoft SQL Server (tedious) |
| **pg** | ^8.13.1 | Driver para PostgreSQL (node-postgres) |
| **mysql2** | ^3.11.5 | Driver para MySQL/MariaDB con Promises |
| **dotenv** | ^16.4.7 | Gestión de variables de entorno |

### 9.4 Landing Page
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **React** | 19 | Librería de UI para componentes |
| **Vite** | — | Build tool y dev server |
| **CSS vanilla** | — | Estilos sin frameworks externos |
| **Vercel** | — | Plataforma de despliegue |

### 9.5 Instalador de Windows
| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Electron** | ^28.2.0 | Framework para aplicaciones de escritorio |
| **electron-builder** | ^24.9.0 | Empaquetador de Electron en .exe |
| **WinSW** | — | Windows Service Wrapper (ejecutar Node.js como servicio de Windows) |

### 9.6 Protocolos de Comunicación
| Protocolo | Uso |
|-----------|-----|
| **HTTP/HTTPS** | Comunicación App → Servidor (API REST) |
| **WebSocket (ws/wss)** | Comunicación Servidor ↔ Agente (túnel inverso bidireccional) |
| **TDS** | Protocolo nativo de Microsoft SQL Server |
| **PostgreSQL wire protocol** | Protocolo nativo de PostgreSQL |
| **MySQL client/server protocol** | Protocolo nativo de MySQL |

---

## 10. ESTRUCTURA DE ARCHIVOS DEL PROYECTO

```
agentstructure/
├── README.md                         # Documentación principal del proyecto
├── package.json                      # Paquete raíz con scripts de instalación
├── install.js                        # Instalador interactivo por terminal (cross-platform)
├── vercel.json                       # Configuración de despliegue de la landing page
├── .gitignore                        # Archivos y carpetas excluidos de Git
│
├── agent/                            # ── AGENTE ON-PREMISE ──
│   ├── package.json                  # Dependencias y scripts del agente
│   ├── index.js                      # Punto de entrada: conexión WS, manejo de queries
│   ├── config.json.example           # Plantilla de configuración (credenciales ficticias)
│   ├── queries.json                  # Lista blanca de consultas SQL permitidas
│   ├── .gitignore                    # Excluye config.json y logs/
│   ├── lib/
│   │   ├── queryResolver.js          # Resolvedor de acciones: valida y resuelve SQL
│   │   └── audit.js                  # Módulo de auditoría: log de accesos diario
│   └── db/
│       ├── connector.js              # Factory de conexión multi-motor
│       └── drivers/
│           ├── mssqlDriver.js        # Driver para Microsoft SQL Server
│           ├── pgDriver.js           # Driver para PostgreSQL
│           └── mysqlDriver.js        # Driver para MySQL/MariaDB
│
├── server/                           # ── SERVIDOR CENTRAL (API GATEWAY) ──
│   ├── package.json                  # Dependencias y scripts del servidor
│   ├── index.js                      # Punto de entrada: Express + WebSocket Server
│   ├── .env.example                  # Plantilla de variables de entorno
│   ├── agents.json.example           # Plantilla de registro de agentes autorizados
│   ├── .gitignore                    # Excluye .env y agents.json
│   ├── middleware/
│   │   └── apiKey.js                 # Middleware de autenticación por API Key
│   ├── routes/
│   │   └── api.js                    # Rutas REST: /query/:clienteId, /agents, /status
│   ├── ws/
│   │   └── socketHandler.js          # Manejador de conexiones WebSocket de agentes
│   └── lib/
│       ├── registry.js               # Registro de agentes conectados y correlaciones
│       └── cache.js                  # Caché en memoria (node-cache)
│
├── landing/                          # ── LANDING PAGE (PRESENTACIÓN) ──
│   ├── package.json                  # Dependencias (React, Vite)
│   ├── index.html                    # HTML base
│   ├── vite.config.js                # Configuración de Vite
│   └── src/
│       ├── main.jsx                  # Punto de entrada React
│       ├── App.jsx                   # Componente raíz
│       ├── index.css                 # Estilos globales
│       └── components/
│           ├── Navbar.jsx / .css     # Barra de navegación
│           ├── Hero.jsx / .css       # Sección héroe
│           ├── Architecture.jsx / .css # Diagrama de arquitectura
│           ├── Features.jsx / .css   # Características del proyecto
│           ├── InstallSection.jsx / .css # Instrucciones de instalación
│           └── Footer.jsx / .css     # Pie de página
│
└── windows-installer/                # ── INSTALADOR GRÁFICO PARA WINDOWS ──
    ├── package.json                  # Dependencias (Electron, electron-builder)
    ├── main.js                       # Proceso principal de Electron
    ├── index.html                    # Interfaz del wizard
    ├── style.css                     # Estilos de la interfaz
    ├── renderer.js                   # Lógica del frontend
    ├── scripts/
    │   └── download-winsw.js         # Descarga WinSW automáticamente
    └── bin/                          # Ejecutable WinSW para servicios de Windows
```

---

## 11. DETALLE TÉCNICO ARCHIVO POR ARCHIVO

(Ya cubierto extensamente en la sección 5. Cada archivo fue descrito con su propósito, funcionamiento interno, parámetros, valores de retorno, y relación con los demás módulos.)

---

## 12. SISTEMA DE AUDITORÍA Y TRAZABILIDAD

### 12.1 Propósito
El sistema de auditoría registra en archivos de texto plano cada acción que se ejecuta en el agente. Permite a la empresa saber:
- **Quién** pidió datos (la acción solicitada).
- **Qué** datos pidió (los parámetros enviados).
- **Cuándo** lo pidió (fecha y hora exacta).
- **Si fue exitoso** o si hubo un error.
- **Cuánto tardó** la consulta (en milisegundos).
- **Cuántos datos** se devolvieron (número de filas).

### 12.2 Formato del Log
```
[YYYY-MM-DD HH:mm:ss] ACTION: nombre_accion | PARAMS: {JSON} | STATUS: OK/ERROR | ROWS: N | TIME: Xms
```

### 12.3 Almacenamiento
- Un archivo por día: `logs/audit_2026-01-15.log`
- Los archivos se acumulan en la carpeta `agent/logs/`.
- La empresa puede archivarlos, rotarlos, o enviarlos a un sistema SIEM.
- Los registros permanecen dentro de la red local de la empresa.

### 12.4 Tolerancia a Fallos
Si la escritura del log falla (disco lleno, permisos), solo se muestra un error en consola. El agente NO se detiene. La auditoría nunca bloquea el funcionamiento del servicio.

---

## 13. SISTEMA DE CACHÉ EN MEMORIA

### 13.1 Propósito
Si 50 usuarios piden exactamente los mismos datos en un corto período, el agente solo trabaja UNA VEZ. Los otros 49 reciben la respuesta instantáneamente desde la caché del servidor.

### 13.2 Implementación
- Librería: `node-cache` (almacenamiento en RAM, sin Redis).
- Llave de caché: `clienteId::action::params_JSON_ordenados`.
- TTL configurable por variable de entorno (`CACHE_DEFAULT_TTL` en segundos).
- Limpieza automática de entradas expiradas cada 60 segundos.
- Invalidación por cliente: puede limpiar toda la caché de un clienteId específico.
- Límite máximo de 1000 entradas (`maxKeys: 1000`) para evitar crecimiento descontrolado de memoria (OOM).
- Protección de payload: las respuestas que superen 1 MB (~1,048,576 bytes) no se almacenan en caché para evitar que un solo resultado masivo sature la RAM del proceso Node.js.

### 13.3 Limitaciones
- La caché es por proceso. Si el servidor se reinicia, se pierde.
- No se distribuye entre múltiples instancias del servidor.
- Es ideal para datos que no cambian frecuentemente (catálogos, configuraciones).

---

## 14. COMPRESIÓN Y OPTIMIZACIÓN DE TRANSFERENCIA

### 14.1 Compresión GZIP (Capa HTTP)
El Servidor Central utiliza el middleware `compression` de Express para comprimir automáticamente todas las respuestas HTTP con GZIP. Esto reduce el tamaño de transferencia en aproximadamente un 90% (ej. un JSON de 2 MB se transmite como ~150 KB), mejorando drásticamente la experiencia del usuario final.

### 14.2 Compresión Deflate (Capa WebSocket)
Los mensajes intercambiados entre el Servidor Central y el Agente On-Premise por el túnel WebSocket se comprimen en binario usando la extensión nativa `perMessageDeflate` del protocolo WebSocket (RFC 7692). Esto protege la velocidad de subida (upload) de la red local del Agente, reduciendo el peso de los datos transmitidos por el túnel en ~90%.

### 14.3 Paginación de Consultas
Para consultas que devuelven grandes volúmenes de datos (1500+ registros), se recomienda utilizar paginación en las definiciones de `agent/queries.json` usando `OFFSET`/`FETCH` (SQL Server) o `LIMIT`/`OFFSET` (PostgreSQL/MySQL). Esto evita saturar la red, la RAM y el CPU tanto del Agente como del Servidor Central. Cada página se cachea de forma independiente, manteniendo la latencia ultra baja en peticiones repetitivas.

**Ejemplo de petición paginada:**
```json
POST /query/empresa_abc
{
  "action": "get_clientes_paginados",
  "params": { "Offset": 0, "Limit": 100 }
}
```

---

## 15. SOPORTE MULTI-MOTOR DE BASE DE DATOS

### 14.1 Motores Soportados

| Motor | Librería npm | Puerto Predeterminado | Sintaxis de Parámetros Nativa |
|-------|-------------|----------------------|------------------------------|
| Microsoft SQL Server | `mssql` | 1433 | `@NombreParametro` |
| PostgreSQL | `pg` | 5432 | `$1, $2, $3...` |
| MySQL / MariaDB | `mysql2` | 3306 | `?` |

### 14.2 Conversión Automática de Sintaxis
Las queries en `queries.json` siempre usan la sintaxis `@NombreParametro` (estilo SQL Server) por convención del proyecto. Los drivers de PostgreSQL y MySQL convierten automáticamente esta sintaxis a la nativa de cada motor:
- PostgreSQL: `@IdCliente` → `$1`
- MySQL: `@IdCliente` → `?`

### 14.3 Interfaz Unificada
Todos los drivers implementan la misma interfaz:
```javascript
// Ejecutar una query
executeQuery(dbConfig, sql, params, paramTypes) → { recordset, recordsets, rowsAffected }

// Cerrar el pool de conexiones
closePool() → void
```

Esto permite que el código del agente sea completamente agnóstico al motor de base de datos.

---

## 15. SISTEMA DE RECONEXIÓN AUTOMÁTICA

### 15.1 Algoritmo de Backoff Exponencial

Cuando el agente pierde la conexión con el servidor (por caída de red, reinicio del servidor, etc.), no intenta reconectarse inmediatamente. En su lugar, usa un algoritmo de **backoff exponencial**:

| Intento | Espera | Fórmula |
|---------|--------|---------|
| 1° | 1s | initialDelayMs (1000) |
| 2° | 2s | 1000 × 2¹ |
| 3° | 4s | 1000 × 2² |
| 4° | 8s | 1000 × 2³ |
| 5° | 16s | 1000 × 2⁴ |
| 6° | 30s | min(32000, maxDelayMs) → 30s |
| 7°+ | 30s | Se mantiene en el máximo |

### 15.2 Propósito
- Evitar saturar el servidor con miles de intentos de reconexión por segundo.
- Evitar congestionar la red durante una caída masiva.
- Dar tiempo al servidor para recuperarse antes de intentar de nuevo.
- Una vez reconectado exitosamente, el delay vuelve a 1 segundo para que futuras reconexiones sean rápidas.

---

## 16. ARCHIVOS DE CONFIGURACIÓN (Ejemplos Reales)

### 16.1 Servidor: `.env`
```env
PORT=3500
API_KEY=e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5
QUERY_TIMEOUT_MS=30000
CACHE_DEFAULT_TTL=60
```

### 16.2 Servidor: `agents.json`
```json
{
  "empresa_abc": {
    "secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "description": "Oficina principal - SQL Server 2019"
  },
  "sucursal_norte": {
    "secret": "q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
    "description": "Sucursal Norte - PostgreSQL 15"
  }
}
```

### 16.3 Agente: `config.json`
```json
{
  "clienteId": "empresa_abc",
  "serverUrl": "wss://mi-servidor.com:3500/ws",
  "agentSecret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "readOnly": true,
  "reconnect": { "initialDelayMs": 1000, "maxDelayMs": 30000, "backoffMultiplier": 2 },
  "dbEngine": "mssql",
  "db": {
    "server": "192.168.1.10",
    "port": 1433,
    "database": "SistemaAdministrativo",
    "user": "consultas_app",
    "password": "P@ssw0rd_Segur0",
    "options": { "encrypt": false, "trustServerCertificate": true, "requestTimeout": 30000, "connectionTimeout": 15000 }
  }
}
```

### 16.4 Agente: `queries.json`
(Ver el contenido completo en la sección 5.2.3)

---

## 17. DIAGRAMA DE SECUENCIA DEL FLUJO COMPLETO

```
Aplicación            Servidor Central           Agente On-Premise         Base de Datos
  Cliente               (Cloud/VPS)              (Red Local)               (SQL Server)
    │                       │                         │                        │
    │                       │  ┌──────────────────┐   │                        │
    │                       │  │ FASE DE CONEXIÓN │   │                        │
    │                       │  └──────────────────┘   │                        │
    │                       │                         │                        │
    │                       │◄─── WebSocket CONNECT ──┤ (Conexión de SALIDA)   │
    │                       │                         │                        │
    │                       │◄─ auth {clienteId,      │                        │
    │                       │    secret, actions[]}──-│                        │
    │                       │                         │                        │
    │                       │─── Valida secret ──►    │                        │
    │                       │    contra agents.json   │                        │
    │                       │                         │                        │
    │                       │─── authResult ──────────┤                        │
    │                       │    {success: true}      │                        │
    │                       │                         │                        │
    │  ┌──────────────────┐ │                         │                        │
    │  │ FASE DE CONSULTA │ │                         │                        │
    │  └──────────────────┘ │                         │                        │
    │                       │                         │                        │
    ├── POST /query/emp_abc │                         │                        │
    │   {action, params}    │                         │                        │
    │   Header: X-Api-Key   │                         │                        │
    │──────────────────────►│                         │                        │
    │                       │                         │                        │
    │                       │── Valida API Key        │                        │
    │                       │── Verifica agente       │                        │
    │                       │── Valida action         │                        │
    │                       │── Revisa caché          │                        │
    │                       │── Genera correlationId  │                        │
    │                       │                         │                        │
    │                       │── query {correlationId, │                        │
    │                       │   action, params} ─────►│                        │
    │                       │   (Solo nombre, NO SQL) │                        │
    │                       │                         │                        │
    │                       │                         │── Busca acción en      │
    │                       │                         │   queries.json         │
    │                       │                         │── Valida parámetros    │
    │                       │                         │── Verifica readOnly    │
    │                       │                         │── Obtiene SQL          │
    │                       │                         │                        │
    │                       │                         │── SQL parametrizado ──►│
    │                       │                         │   @Param → valor       │
    │                       │                         │                        │
    │                       │                         │◄── Resultado (filas) ──│
    │                       │                         │                        │
    │                       │                         │── Registra en          │
    │                       │                         │   audit log            │
    │                       │                         │                        │
    │                       │◄── queryResult          │                        │
    │                       │   {correlationId, data} │                        │
    │                       │                         │                        │
    │                       │── Resuelve Promise      │                        │
    │                       │── Guarda en caché       │                        │
    │                       │                         │                        │
    │◄──────────────────────│                         │                        │
    │  200 OK {data}        │                         │                        │
    │                       │                         │                        │
```

---

## 18. GLOSARIO DE TÉRMINOS TÉCNICOS

| Término | Definición |
|---------|-----------|
| **On-Premise** | Infraestructura tecnológica instalada y operada dentro de las instalaciones físicas de la empresa, en contraposición a servicios en la nube. |
| **API Gateway** | Servidor intermediario que actúa como punto de entrada único para un grupo de servicios backend. Gestiona autenticación, enrutamiento y transformación de peticiones. |
| **WebSocket** | Protocolo de comunicación (RFC 6455) que proporciona canales de comunicación full-duplex (bidireccional) sobre una única conexión TCP. Ideal para comunicación en tiempo real. |
| **Túnel Inverso** | Técnica de red donde el cliente (dentro de una red privada) inicia una conexión de salida hacia un servidor público, estableciendo un canal de comunicación bidireccional sin necesidad de abrir puertos entrantes en el firewall. |
| **Firewall** | Sistema de seguridad de red que monitoriza y controla el tráfico de red entrante y saliente basándose en reglas de seguridad predefinidas. |
| **Connection Pooling** | Técnica de gestión de recursos que mantiene un grupo de conexiones de base de datos abiertas y reutilizables, reduciendo el overhead de crear y destruir conexiones por cada operación. |
| **Backoff Exponencial** | Algoritmo de reconexión que incrementa progresivamente el tiempo de espera entre reintentos (1s, 2s, 4s, 8s...) para evitar saturar el servidor o la red durante fallos. |
| **Correlation ID** | Identificador único (UUID) que vincula una solicitud con su respuesta a través de sistemas distribuidos y/o asincrónicos. Permite rastrear el ciclo de vida completo de una petición. |
| **Factory Pattern** | Patrón de diseño creacional que proporciona una interfaz para crear objetos sin especificar su clase exacta. En este proyecto, selecciona el driver de BD apropiado según la configuración. |
| **Action Manifest** | Lista declarativa de acciones/capacidades que un agente envía al servidor al autenticarse, permitiendo validación anticipada de solicitudes. |
| **Lista Blanca (Whitelist)** | Mecanismo de seguridad que solo permite elementos explícitamente aprobados. En este proyecto, solo las queries definidas en queries.json pueden ejecutarse. |
| **API Key** | Token de autenticación estático usado para identificar y autorizar aplicaciones clientes. Se envía como header HTTP en cada petición. |
| **TTL (Time-To-Live)** | Tiempo de vida de un dato en caché antes de ser eliminado automáticamente. |
| **Heartbeat** | Señal periódica (ping/pong) enviada entre sistemas conectados para verificar que la conexión sigue activa. |
| **SQL Injection** | Ataque de seguridad que inserta código SQL malicioso en los parámetros de entrada de una aplicación. Prevenido en este proyecto mediante queries parametrizadas. |
| **WinSW** | Windows Service Wrapper. Herramienta que permite ejecutar cualquier programa como un servicio de Windows. |
| **Electron** | Framework que permite crear aplicaciones de escritorio multiplataforma usando tecnologías web (HTML, CSS, JavaScript). |
| **Express.js** | Framework web minimalista para Node.js que proporciona un robusto conjunto de características para aplicaciones web y APIs. |
| **CORS** | Cross-Origin Resource Sharing. Mecanismo de seguridad del navegador que permite o restringe solicitudes HTTP entre diferentes orígenes (dominios). |
| **Helmet** | Middleware de Express que configura cabeceras HTTP de seguridad para proteger aplicaciones contra vulnerabilidades comunes. |
| **UUID** | Universally Unique Identifier. Identificador de 128 bits generado aleatoriamente con probabilidad de colisión prácticamente nula. |
| **NAT** | Network Address Translation. Técnica que traduce direcciones IP privadas a una dirección pública compartida. Hace que las máquinas internas no sean directamente accesibles desde internet. |
| **VPS** | Virtual Private Server. Máquina virtual alojada en un centro de datos con IP pública y acceso a internet. |
| **REST** | Representational State Transfer. Estilo arquitectónico para diseñar APIs web basado en recursos, verbos HTTP y representaciones JSON/XML. |
| **Middleware** | Función que se ejecuta entre la recepción de una petición HTTP y la respuesta. Puede modificar la petición, la respuesta, o cortar el flujo. |
| **Full-Duplex** | Modo de comunicación donde ambas partes pueden enviar y recibir datos simultáneamente, sin esperar turnos. |
| **Soberanía del Dato** | Principio que establece que una organización mantiene control absoluto sobre dónde se almacenan, procesan y transfieren sus datos. |

---

## NOTA FINAL

Este documento contiene la descripción completa, técnica y funcional del proyecto AgentStructure. Toda la información aquí presentada fue extraída directamente del código fuente del repositorio, incluyendo los comentarios en el código, la estructura de archivos, las dependencias, los patrones de diseño, los mecanismos de seguridad, y los flujos de datos. El proyecto es funcional y ha sido probado en entornos reales con bases de datos Microsoft SQL Server en redes corporativas.
