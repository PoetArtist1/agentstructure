# 🛡️ AgentStructure

[![Node.js Version](https://img.shields.io/badge/Node.js-v18+-green?style=flat-for-the-badge&logo=node.js)](https://nodejs.org)

**Soberanía de Datos y Conectividad Segura para Entornos On-Premise.**

**AgentStructure** es una arquitectura híbrida de **Agente-Servidor** diseñada
para resolver un problema crítico de integración: permitir que aplicaciones
externas o en la nube consuman datos específicos de bases de datos locales
(On-Premise) de forma segura, **sin otorgar acceso directo a la base de datos y
manteniendo total control sobre las sentencias SQL.**

Este proyecto ha sido desarrollado como una propuesta de **Tesis de Grado** para
la implementación de soluciones empresariales en redes locales cerradas.

---

## 💡 El Problema y la Solución

### El Desafío Común

Las organizaciones suelen ser reticentes (y con razón) a exponer sus
credenciales de base de datos o abrir puertos de entrada en sus firewalls
(`3306`, `5432`, `1433`) para conectar aplicaciones externas.

### La Propuesta de AgentStructure

En lugar de que el servidor en la nube guarde las queries SQL y posea acceso
directo a la base de datos:

1. **Las queries residen localmente en el Agente**, dentro de la red
   corporativa.
2. El Servidor Central solo conoce **"nombres de acciones"** (por ejemplo:
   `obtener_clientes`) y parámetros necesarios.
3. El Agente inicia la conexión al Servidor mediante un túnel seguro
   bidireccional (**WebSockets**), evitando abrir puertos entrantes.
4. Cuando el Servidor recibe una petición HTTP, retransmite la acción al Agente,
   quien resuelve la consulta localmente, audita el acceso y retorna únicamente
   los datos crudos.

---

## 🎨 Diagrama de Conexión

```mermaid
sequenceDiagram
    participant App as Aplicación Cliente
    participant Server as Servidor Central (Cloud)
    participant Agent as Agente On-Premise (Red Local)
    participant DB as "Base de Datos (SQL Server/PG/MySQL)"

    Note over Agent, Server: 1. Conexión WebSocket Reversa (Túnel)
    Agent->>Server: Conecta WebSocket (Autenticado con ClientID + Secret)
    
    Note over App, Server: 2. Solicitud de Datos externa
    App->>Server: POST /query/empresa_abc header{x-api-key:example-key} body{ action: "obtener_ventas", params: { anio: 2026 } } 
    
    Note over Server: 3. Chequeo de Caché (CACHE_DEFAULT_TTL > 0)
    alt Cache HIT (Datos en memoria)
        Server-->>App: Responde 200 OK con datos de caché (Latencia < 5ms)
    else Cache MISS (Consultar al Agente)
        Server->>Agent: Transmite acción "obtener_ventas" + params
        Agent->>Agent: Valida tipos de parámetros & busca query SQL en queries.json
        Agent->>DB: Ejecuta SELECT ... WHERE anio = 2026
        DB-->>Agent: Devuelve set de datos
        Agent->>Agent: Registra acceso en log de auditoría local
        Agent-->>Server: Envía JSON de respuesta por WebSocket
        Server->>Server: Almacena en caché (node-cache)
        Server-->>App: Responde 200 OK con los datos
    end
```

---

## 📐 Diagramas de Arquitectura

### 1. Diagrama de Casos de Uso

```mermaid
graph TD
    SCE["🖥️ Sistema Consumidor Externo"]
    DB["🗄️ Base de Datos Relacional"]

    subgraph CU_SERVER ["☁️ Servidor Central - API Gateway"]
        UC1["Autenticar App consumidora\nmediante API Key"]
        UC2["Verificar credenciales\ndel Agente en agents.json"]
        UC3["Registrar Action Manifest"]
        UC4["Solicitar extracción\nde información"]
        UC5["Gestionar caché\nde respuestas"]
    end

    subgraph CU_AGENT ["🔌 Agente Local On-Premise"]
        UC6["Establecer túnel\nWebSocket inverso"]
        UC7["Resolver consulta\nlocal en queries.json"]
        UC8["Ejecutar SELECT\nlocal"]
        UC9["Registrar log de\nauditoria local"]
    end

    SCE -->|"POST /query/:clienteId\n+ X-Api-Key"| UC1
    UC1 -->|"incluye"| UC4
    UC4 -->|"incluye"| UC5

    UC6 -->|"incluye"| UC2
    UC6 -->|"incluye"| UC3

    UC4 -->|"type: query\n+ correlationId"| UC7
    UC7 -->|"incluye"| UC8
    UC8 -->|"driver SQL"| DB
    UC8 -->|"incluye"| UC9

    style SCE fill:#1e40af,color:#fff,stroke:#1e3a8a
    style DB fill:#4a044e,color:#fff,stroke:#3b0764
    style CU_SERVER fill:#0a2e1a,color:#fff,stroke:#065f46
    style CU_AGENT fill:#2a1008,color:#fff,stroke:#7c2d12
```

---

### 2. Topología de Red Virtualizada (Docker)

```mermaid
graph TD
    subgraph HOST ["💻 Host / Entorno de Pruebas"]
        JMETER["🔥 JMeter\n(Cliente de Carga)"]
    end

    subgraph DOCKER_NET ["🐳 Red Docker — simulation-lab_default"]
        
        subgraph CLOUD ["☁️ Zona Nube (Simulada)"]
            SRV["📦 Contenedor: sim-central-server\n(Servidor Central / API)\nPuerto 3500"]
        end

        subgraph ONPREMISE ["🏢 Zona On-Premise (Simulada)"]
            AGT["📦 Contenedor: sim-local-agent\n(Agente Local)"]
            DB["📦 Contenedor: sim-database\n(PostgreSQL)\nPuerto 5432"]
        end
    end

    %% 1. Conexión de control (Túnel WebSocket con flecha gruesa corregida)
    AGT ==>|"1. Agente inicia y establece Túnel WebSocket Reverso (ws://server:3500)"| SRV

    %% 2. Flujo de datos de una consulta
    JMETER -->|"2. POST /query"| SRV
    SRV -->|"3. Envía payload de la query por el túnel WS"| AGT
    AGT -->|"4. Ejecuta Query SQL localmente"| DB
    DB -->|"5. Retorna resultados de la consulta"| AGT
    AGT -->|"6. Devuelve resultados por el túnel WS"| SRV
    SRV -->|"7. Responde JSON"| JMETER

    %% Estilos visuales
    style DOCKER_NET fill:#111827,stroke:#374151,color:#fff
    style CLOUD fill:#0c2d48,stroke:#1e4d6b,color:#fff
    style ONPREMISE fill:#1a0a0a,stroke:#5c1a1a,color:#fff
    style HOST fill:#1f2937,stroke:#4b5563,color:#fff
    style SRV fill:#065f46,color:#fff,stroke:#064e3b
    style AGT fill:#7c2d12,color:#fff,stroke:#6b1d0f
    style DB fill:#1e3a5f,color:#fff,stroke:#1e40af
    style JMETER fill:#4b5563,color:#fff,stroke:#374151
```

---

### 3. Diagrama de Secuencia UML — Ciclo de Vida Completo de una Consulta

```mermaid
sequenceDiagram
    participant App as App Consumidora<br/>(HTTP Client)
    participant GW as Servidor Central<br/>(API Gateway)
    participant Cache as Caché en Memoria
    participant Agent as Agente Local<br/>On-Premise
    participant DB as Motor de Base<br/>de Datos Local

    Note over Agent, GW: ── FASE 1: Establecimiento del Túnel ──

    Agent->>GW: WebSocket CONNECT ws://servidor:3500/ws
    Agent->>GW: type:"auth" { clienteId, secret, actions:[...] }
    GW->>GW: Verifica secret contra agents.json
    GW->>GW: Registra Action Manifest del agente
    GW-->>Agent: type:"authResult" { ok: true }

    Note over App, DB: ── FASE 2: Petición HTTP desde la App ──

    App->>GW: POST /query/empresa_abc<br/>Header: X-Api-Key<br/>Body: { action:"get_clientes", params:{} }
    GW->>GW: Verifica API Key → HTTP 401 si inválida
    GW->>GW: Verifica agente conectado → HTTP 502 si ausente
    GW->>GW: Valida action vs Action Manifest → HTTP 404 si no existe

    Note over GW, Cache: ── FASE 3A: Cache HIT ──

    GW->>Cache: GET "empresa_abc::get_clientes::{}"
    Cache-->>GW: ✅ Datos encontrados (TTL vigente)
    GW-->>App: HTTP 200 OK { ok:true, fromCache:true, data:[...] }

    Note over GW, DB: ── FASE 3B: Cache MISS + Singleflight ──

    GW->>Cache: GET "empresa_abc::get_clientes::{}"
    Cache-->>GW: ❌ undefined (no existe o expiró)
    GW->>GW: Crea flightPromise (Singleflight)<br/>Registra en mapa inflight[]
    GW->>GW: correlationId = uuidv4()<br/>Almacena Promise en registry.pending
    GW->>Agent: WebSocket type:"query"<br/>{ correlationId, action:"get_clientes", params:{} }

    Note over Agent, DB: ── FASE 4: Resolución Local en el Agente ──

    Agent->>Agent: Valida action en queries.json
    Agent->>Agent: Sanitiza y tipifica parámetros
    Agent->>DB: Ejecuta SELECT con driver (mssql/pg/mysql)
    DB-->>Agent: Recordset con resultados
    Agent->>Agent: audit.js → escribe log local<br/>[fecha] ACTION: get_clientes | STATUS: OK | ROWS: 1740

    Note over Agent, GW: ── FASE 5: Retorno y Resolución ──

    Agent-->>GW: WebSocket type:"queryResult"<br/>{ correlationId, data:{recordset:[...]} }
    GW->>GW: registry.resolvePending(correlationId)<br/>Despierta Promise pausada
    GW->>Cache: SET "empresa_abc::get_clientes::{}" TTL:60s
    GW->>GW: inflight.delete(cacheKey)
    GW-->>App: HTTP 200 OK { ok:true, fromCache:false, data:[...] }
```

---

## 🎨 Diagrama de Conexión

```mermaid
sequenceDiagram
    participant App as Aplicación Cliente
    participant Server as Servidor Central (Cloud)
    participant Agent as Agente On-Premise (Red Local)
    participant DB as "Base de Datos (SQL Server/PG/MySQL)"

    Note over Agent, Server: 1. Conexión WebSocket Reversa (Túnel)
    Agent->>Server: Conecta WebSocket (Autenticado con ClientID + Secret)
    
    Note over App, Server: 2. Solicitud de Datos externa
    App->>Server: POST /query/empresa_abc header{x-api-key:example-key} body{ action: "obtener_ventas", params: { anio: 2026 } } 
    
    Note over Server: 3. Chequeo de Caché (CACHE_DEFAULT_TTL > 0)
    alt Cache HIT (Datos en memoria)
        Server-->>App: Responde 200 OK con datos de caché (Latencia < 5ms)
    else Cache MISS (Consultar al Agente)
        Server->>Agent: Transmite acción "obtener_ventas" + params
        Agent->>Agent: Valida tipos de parámetros & busca query SQL en queries.json
        Agent->>DB: Ejecuta SELECT ... WHERE anio = 2026
        DB-->>Agent: Devuelve set de datos
        Agent->>Agent: Registra acceso en log de auditoría local
        Agent-->>Server: Envía JSON de respuesta por WebSocket
        Server->>Server: Almacena en caché (node-cache)
        Server-->>App: Responde 200 OK con los datos
    end
```

---

## ✨ Características Destacadas

- 🔒 **Soberanía Absoluta del Dato:** Las sentencias SQL residen en el
  cliente/empresa. La lógica de bases de datos nunca sale de la red local.
- 🔌 **Conexión Inversa (WebSockets):** El Agente se conecta al Servidor. Cero
  configuraciones complejas de Firewall o NAT en la infraestructura corporativa.
- 🛡️ **Seguridad por Diseño:**
  - **API Key** para la comunicación entre aplicaciones y el servidor.
  - **Secretos criptográficos individuales** y únicos por cada Agente registrado
    en `agents.json`.
  - **Modo de Solo Lectura (Read-Only):** Configurable por agente para mitigar
    riesgos de inyección o alteración de datos.
- 📊 **Auditoría e Historial:** Registro persistente de accesos en el agente
  local que detalla la acción solicitada, parámetros, fecha y si fue exitosa.
- 🗄️ **Multi-Motor de Base de Datos:** Soporte nativo y pre-configurado para:
  - **PostgreSQL**
  - **MySQL** / MariaDB
  - **Microsoft SQL Server (MSSQL)**
- 💻 **Instalador Interactivo:** Un asistente por consola rápido que guía la
  inicialización de ambos roles.
- ⚡ **Caché en Memoria (Opcional):** Almacenamiento temporal integrado
  (`node-cache`) en el Servidor Central que previene la sobrecarga de consultas
  en el Agente y disminuye drásticamente la latencia en peticiones repetitivas.
- 📦 **Compresión GZIP y WebSocket Deflate:** Las respuestas HTTP se comprimen
  automáticamente con GZIP (~90% de reducción) y los mensajes WebSocket usan
  `perMessageDeflate` para minimizar el tráfico entre el Servidor y el Agente.
- 📄 **Paginación Nativa:** Soporte integrado para consultas paginadas con
  `OFFSET`/`FETCH` (SQL Server), `LIMIT`/`OFFSET` (PostgreSQL/MySQL), evitando
  la transferencia de grandes volúmenes de datos en un solo paquete.

---

## 📂 Estructura del Repositorio

- [`/agent`](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent):
  Código fuente del Agente local, resolvedor de queries y auditoría.
- [`/server`](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/server):
  Código del Servidor central que actúa como API Gateway y maneja las conexiones
  WebSocket de múltiples agentes.
- [`/landing`](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/landing):
  Landing page interactiva construida en **React + Vite** para la presentación
  del proyecto.
- [`install.js`](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/install.js):
  Script de configuración inicial automatizado para el entorno.

---

## 🛠️ Instalación y Configuración

El proyecto cuenta con un asistente interactivo por terminal que automatiza la
creación de los archivos de configuración en Windows, macOS y Linux.

Sigue los pasos a continuación para instalar y configurar de forma precisa tanto
el **Servidor Central** como el **Agente On-Premise**.

---

### Paso 1: Clonar el Repositorio e Instalar Dependencias

Clona el repositorio en la máquina donde vayas a trabajar e instala las
dependencias base:

```bash
git clone https://github.com/PoetArtist1/agentstructure.git
cd agentstructure
node install.js
```

El script interactivo `install.js` te guiará para configurar los componentes. Si
lo prefieres, también puedes hacer la configuración de forma manual copiando y
renombrando los archivos de plantilla que se detallan a continuación.

---

### Paso 2: Configuración del Servidor Central (Cloud)

El Servidor actúa como API Gateway y Hub de WebSockets. Requiere dos archivos
principales en el directorio `/server`:

#### 1. Archivo de Entorno: `server/.env`

Crea este archivo copiando `server/.env.example`. Este define el comportamiento
del servidor HTTP y la seguridad con la aplicación externa.

**Ejemplo de `server/.env`:**

```env
# Puerto en el que escuchará el servidor (HTTP y WebSocket comparten el mismo puerto)
PORT=3500

# API Key requerida en las peticiones HTTP externas (Header: X-Api-Key)
# Genera una segura en producción usando: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY=mi-clave-de-api-super-segura-cambiar-en-produccion

# Tiempo máximo (en milisegundos) a esperar por la respuesta del agente antes de retornar un 504 Gateway Timeout
QUERY_TIMEOUT_MS=30000

# Tiempo de vida en segundos de la caché en memoria (0 o vacío para desactivar)
CACHE_DEFAULT_TTL=60
```

#### 2. Registro de Agentes Autorizados: `server/agents.json`

Crea este archivo copiando `server/agents.json.example`. En él se configuran las
credenciales que usará cada agente para autenticarse por WebSocket.

**Ejemplo de `server/agents.json`:**

```json
{
  "empresa_ejemplo": {
    "secret": "generar-un-secret-unico-aqui",
    "description": "Cliente principal - Base de Datos SQL Server Local"
  },
  "sucursal_norte": {
    "secret": "otro-secret-totalmente-diferente",
    "description": "Sucursal Norte - Servidor de Ventas MySQL"
  }
}
```

- **Clave del Objeto (`empresa_ejemplo`, `sucursal_norte`)**: Corresponde al
  `clienteId` que usará el Agente para presentarse.
- **`secret`**: Contraseña secreta para validar la conexión del túnel WebSocket.
- **`description`**: Información descriptiva e interna del agente.

---

### Paso 3: Configuración del Agente On-Premise

El Agente reside dentro de la red privada de tu base de datos. Requiere dos
archivos en el directorio `/agent`:

#### 1. Archivo de Configuración: `agent/config.json`

Crea este archivo copiando `agent/config.json.example`. Contiene la URL del
servidor, las credenciales del túnel y la cadena de conexión local de la base de
datos.

**Ejemplo de `agent/config.json`:**

```json
{
  "serverUrl": "ws://localhost:3500/ws",
  "clienteId": "empresa_ejemplo",
  "secret": "generar-un-secret-unico-aqui",

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

##### Parámetros clave a configurar:

- **`serverUrl`**: Dirección IP/Dominio y puerto del Servidor Central. Debe usar
  el protocolo `ws://` (desarrollo) o `wss://` (producción con certificado SSL).
- **`clienteId`**: Identificador único que coincide con el registrado en el
  servidor (`agents.json`).
- **`secret`**: Contraseña de WebSocket que coincide con la registrada en el
  servidor (`agents.json`).
- **`dbEngine`**: Motor de base de datos a conectar. Opciones válidas:
  `"mssql"`, `"postgres"`, `"mysql"`.
- **`db`**: Credenciales de acceso del motor de base de datos. El objeto de
  configuración varía según el motor (`dbEngine`). El ejemplo superior muestra
  la estructura típica para Microsoft SQL Server (`mssql`).

#### 2. Lista Blanca de Consultas: `agent/queries.json`

Este archivo contiene la lógica de base de datos y actúa como barrera de
seguridad de red. Aquí defines las consultas SQL que la aplicación externa puede
invocar. **El servidor web externo nunca puede enviar SQL arbitrario; solo puede
solicitar la clave de una acción configurada en este archivo.**

**Ejemplo de `agent/queries.json`:**

```json
{
  "get_cuentas_cobrar_by_client": {
    "description": "Obtiene cuentas por cobrar de un cliente específico filtrando saldo pendiente",
    "sql": "SELECT IdCliente, IdDocumento, SaldoAct as saldo_pendiente FROM CtsxCobrar WHERE IdCliente = @IdCliente AND SaldoAct > 0.01",
    "params": {
      "IdCliente": { "type": "string", "required": true }
    }
  },
  "get_bancos": {
    "description": "Obtiene todos los bancos registrados",
    "sql": "SELECT idbanco, Descripcion as banco FROM fBancos",
    "params": {}
  },
  "get_clientes_paginados": {
    "description": "Obtiene clientes paginados de 100 en 100 usando OFFSET/FETCH (SQL Server)",
    "sql": "SELECT Codigo as IDCliente, Descripcion as razon_social, Rif as rif FROM Clientes ORDER BY Codigo OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY",
    "params": {
      "Offset": { "type": "int", "required": true },
      "Limit": { "type": "int", "required": true }
    }
  }
}
```

- **Variables parametrizadas (`@IdCliente`)**: Utiliza variables anteponiendo
  `@` para enlazarlas de forma segura y evitar ataques de inyección SQL. El
  Agente mapeará y sanitizará los parámetros antes de pasarlos al motor de base
  de datos.
- **Tipos de datos soportados para parámetros**: `int`, `string`, `float`,
  `decimal`, `boolean`, `date`, `datetime`.
- **Paginación:** Para consultas con grandes volúmenes de datos (más de 500
  registros), se recomienda usar `OFFSET`/`FETCH` (SQL Server) o
  `LIMIT`/`OFFSET` (PostgreSQL/MySQL). La App externa solicita las páginas
  secuencialmente pasando los parámetros `Offset` y `Limit`.

---

### Paso 4: Ejecución en Producción / Desarrollo

Una vez configurados los archivos, puedes iniciar los servicios de la siguiente
manera:

#### Ejecutar el Servidor Central:

```bash
cd server
npm install
npm start
```

_(El servidor comenzará a escuchar peticiones HTTP y WebSocket en el puerto
configurado)._

#### Ejecutar el Agente:

```bash
cd agent
npm install
npm start
```

_(El agente establecerá la conexión inversa por WebSocket con el servidor y
quedará a la espera de consultas)._

---

## ⚡ Rendimiento y Optimización

El Servidor Central incorpora múltiples capas de optimización para soportar alta
concurrencia (40+ clientes, 2000+ usuarios simultáneos) sin degradar el
rendimiento:

### Caché en Memoria (`node-cache`)

- **Activación:** Se controla a nivel global con la variable `CACHE_DEFAULT_TTL`
  (en segundos) en el archivo `server/.env`.
- **Comportamiento:** Si llega una solicitud HTTP idéntica (mismo `clienteId`,
  misma acción y mismos parámetros), el Servidor Central devuelve el resultado
  directamente desde su memoria RAM (_Cache HIT_) sin enviar mensajes por
  WebSocket al agente ni consultar la base de datos local.
- **Limpieza de memoria:** Transcurrido el tiempo asignado en el TTL, la entrada
  en caché expira y se elimina automáticamente, forzando a que la siguiente
  consulta busque datos actualizados directamente del agente.
- **Protección de RAM (maxKeys):** La caché tiene un límite de 1000 entradas
  simultáneas. Al alcanzar el límite, se rechazan nuevas inserciones para evitar
  crecimiento descontrolado de memoria (OOM).
- **Protección de Payload (1 MB):** Las respuestas que superen 1 MB no se
  almacenan en caché. Se sirven directamente al cliente HTTP sin retener datos
  masivos en la memoria RAM del servidor.

### Compresión GZIP (HTTP) y Deflate (WebSocket)

- **GZIP HTTP:** Todas las respuestas HTTP del Servidor Central se comprimen
  automáticamente con GZIP mediante el middleware `compression`. Esto reduce el
  tamaño de transferencia en ~90% (ej. un JSON de 2 MB se transmite como ~150 KB).
- **perMessageDeflate (WebSocket):** Los mensajes intercambiados entre el
  Servidor Central y el Agente por el túnel WebSocket se comprimen en binario
  usando la extensión nativa `perMessageDeflate` del protocolo WebSocket (RFC 7692).
  Esto protege la velocidad de subida (upload) de la red local del Agente.

### Paginación de Consultas

Para consultas que devuelven grandes volúmenes de datos (1500+ registros), se
recomienda encarecidamente utilizar **paginación** en las definiciones de
`agent/queries.json`. Esto evita saturar la red, la RAM y el CPU tanto del
Agente como del Servidor Central.

**Ejemplo de petición paginada:**
```json
POST /query/empresa_abc
{
  "action": "get_clientes_paginados",
  "params": { "Offset": 0, "Limit": 100 }
}
```
La App solicita 100 registros por página. Al hacer scroll o clic en "Siguiente",
envía `Offset: 100`, luego `Offset: 200`, etc. Cada respuesta pesa apenas unos
KB y la caché almacena cada página de forma independiente.
