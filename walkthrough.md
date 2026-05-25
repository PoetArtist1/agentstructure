# gdata-tunnel v2 — Walkthrough Completo

## Resumen

Se implementó el proyecto `agentstructure` como evolución de `gdataagent` + `gdataserver`, con las siguientes mejoras:

| Mejora | Archivo(s) clave |
|---|---|
| Queries definidas en el agente | [queries.json](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/queries.json) |
| Secreto por agente (no global) | [agents.json.example](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/server/agents.json.example) |
| Action Manifest | [agent/index.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/index.js#L73-L78), [registry.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/server/lib/registry.js) |
| Auditoría / Log de accesos | [audit.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/lib/audit.js) |
| Tipos de parámetros | [queryResolver.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/lib/queryResolver.js) |
| API Key (App → Servidor) | [apiKey.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/server/middleware/apiKey.js) |
| Multi-motor de BD | [connector.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/db/connector.js), [drivers/](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/db/drivers) |
| Modo solo-lectura | [queryResolver.js](file:///c:/Users/carlo/OneDrive/Escritorio/TRABAJO/agentstructure/agent/lib/queryResolver.js#L38-L39) |

---

## Estructura de Archivos

```
agentstructure/
├── server/                          # Servidor central (VPS/Cloud)
│   ├── index.js                     # Entry point del servidor
│   ├── package.json
│   ├── .env.example                 # Variables de entorno (PORT, API_KEY, etc.)
│   ├── .gitignore
│   ├── agents.json.example          # Registro de agentes autorizados (secret por agente)
│   ├── middleware/
│   │   └── apiKey.js                # Middleware de autenticación HTTP (X-Api-Key)
│   ├── routes/
│   │   └── api.js                   # Endpoints REST (POST /query, GET /agents, GET /status)
│   ├── ws/
│   │   └── socketHandler.js         # Manejo de conexiones WebSocket (auth + queryResult)
│   └── lib/
│       ├── registry.js              # Registro en memoria de agentes + action manifests
│       └── cache.js                 # Caché en memoria (node-cache)
│
└── agent/                           # Agente on-premise (red del cliente)
    ├── index.js                     # Entry point del agente
    ├── package.json
    ├── .gitignore
    ├── config.json.example          # Config de conexión (BD, servidor, readOnly, dbEngine)
    ├── queries.json                 # Lista blanca de queries con tipos de parámetros
    ├── lib/
    │   ├── queryResolver.js         # Resuelve action→SQL, valida params, modo read-only
    │   └── audit.js                 # Log de auditoría diario
    └── db/
        ├── connector.js             # Factory multi-motor
        └── drivers/
            ├── mssqlDriver.js       # Driver SQL Server (mssql)
            ├── pgDriver.js          # Driver PostgreSQL (pg)
            └── mysqlDriver.js       # Driver MySQL/MariaDB (mysql2)
```

---

## Diagramas

### 1. Diagrama de Arquitectura General

```mermaid
graph TB
    subgraph Internet
        APP["📱 App / Web Client"]
        SERVER["🌐 Servidor Central<br/>(VPS/Cloud)"]
    end

    subgraph Red_Local_Empresa["🏢 Red Local de la Empresa"]
        AGENT["🤖 Agente On-premise"]
        DB["🗄️ Base de Datos<br/>(SQL Server / PostgreSQL / MySQL)"]
    end

    APP -->|"POST /query/:clienteId<br/>Header: X-Api-Key"| SERVER
    SERVER <-->|"WebSocket (WSS)<br/>Conexión outbound<br/>sin abrir puertos"| AGENT
    AGENT -->|"Queries parametrizadas"| DB

    style SERVER fill:#1e40af,stroke:#1e3a8a,color:#fff
    style AGENT fill:#065f46,stroke:#064e3b,color:#fff
    style DB fill:#7c2d12,stroke:#6b2510,color:#fff
    style APP fill:#4338ca,stroke:#3730a3,color:#fff
```

### 2. Diagrama de Flujo de una Petición (Query Flow)

```mermaid
sequenceDiagram
    participant App as 📱 App
    participant Server as 🌐 Servidor
    participant Agent as 🤖 Agente
    participant QR as 📋 QueryResolver
    participant DB as 🗄️ Base de Datos
    participant Audit as 📝 Auditoría

    App->>Server: POST /query/empresa_abc<br/>{ action: "get_clientes", params: {} }<br/>Header: X-Api-Key: xxx

    Note over Server: 1. Valida API Key ✔
    Note over Server: 2. Verifica agente conectado ✔
    Note over Server: 3. Verifica action en manifest ✔
    Note over Server: 4. Revisa caché (miss)

    Server->>Agent: WS: { type: "query",<br/>correlationId: "uuid-123",<br/>action: "get_clientes",<br/>params: {} }

    Agent->>QR: resolve("get_clientes", {}, readOnly)
    Note over QR: 1. ¿Acción en queries.json? ✔
    Note over QR: 2. ¿Modo solo-lectura OK? ✔
    Note over QR: 3. ¿Params requeridos? ✔
    Note over QR: 4. ¿Tipos correctos? ✔
    QR-->>Agent: { success: true, sql: "SELECT...", params, paramTypes }

    Agent->>DB: executeQuery(sql, params)
    DB-->>Agent: { recordset: [...248 filas] }

    Agent->>Audit: log({ action, status: "OK", rows: 248, timeMs: 134 })

    Agent->>Server: WS: { type: "queryResult",<br/>correlationId: "uuid-123",<br/>data: { recordset: [...] } }

    Note over Server: 5. Guarda en caché (si TTL > 0)
    Server->>App: { ok: true, data: { recordset: [...] } }
```

### 3. Diagrama de Autenticación (Doble Capa)

```mermaid
flowchart TD
    subgraph Capa_HTTP["🔐 Capa 1: HTTP (App → Servidor)"]
        A1["App envía petición HTTP"] --> A2{"¿Header X-Api-Key presente?"}
        A2 -->|No| A3["❌ 401 Unauthorized"]
        A2 -->|Sí| A4{"¿Coincide con .env API_KEY?"}
        A4 -->|No| A3
        A4 -->|Sí| A5["✅ Petición permitida"]
    end

    subgraph Capa_WS["🔐 Capa 2: WebSocket (Agente → Servidor)"]
        B1["Agente se conecta"] --> B2{"¿Envió auth en < 10s?"}
        B2 -->|No| B3["❌ Timeout - Conexión cerrada"]
        B2 -->|Sí| B4{"¿clienteId existe en agents.json?"}
        B4 -->|No| B5["❌ ClienteId no autorizado"]
        B4 -->|Sí| B6{"¿Secret coincide con<br/>agents.json[clienteId].secret?"}
        B6 -->|No| B7["❌ Secret inválido"]
        B6 -->|Sí| B8["✅ Agente registrado<br/>+ Action Manifest guardado"]
    end

    style A3 fill:#dc2626,color:#fff
    style A5 fill:#16a34a,color:#fff
    style B3 fill:#dc2626,color:#fff
    style B5 fill:#dc2626,color:#fff
    style B7 fill:#dc2626,color:#fff
    style B8 fill:#16a34a,color:#fff
```

### 4. Diagrama de Soberanía del Dato (Comparación v1 vs v2)

```mermaid
graph LR
    subgraph V1["❌ v1: Queries en el servidor"]
        S1["🌐 Servidor<br/>tiene queries.json<br/>CONOCE el esquema de BD"]
        S1 -->|"Envía SQL completo"| A1["🤖 Agente<br/>solo ejecuta"]
    end

    subgraph V2["✅ v2: Queries en el agente"]
        S2["🌐 Servidor<br/>NO tiene queries.json<br/>NO conoce el esquema"]
        S2 -->|"Envía solo nombre de acción"| A2["🤖 Agente<br/>tiene queries.json<br/>resuelve SQL localmente"]
    end

    style S1 fill:#dc2626,color:#fff
    style S2 fill:#16a34a,color:#fff
    style A1 fill:#737373,color:#fff
    style A2 fill:#16a34a,color:#fff
```

### 5. Diagrama del Factory Pattern (Multi-Motor de BD)

```mermaid
flowchart TD
    C["config.json<br/>dbEngine: ???"] --> F{"connector.js<br/>(Factory)"}
    F -->|"dbEngine = 'mssql'"| D1["mssqlDriver.js<br/>SQL Server<br/>@Param nativo"]
    F -->|"dbEngine = 'postgres'"| D2["pgDriver.js<br/>PostgreSQL<br/>@Param → $1, $2..."]
    F -->|"dbEngine = 'mysql'"| D3["mysqlDriver.js<br/>MySQL/MariaDB<br/>@Param → ?"]

    D1 --> DB1["🗄️ SQL Server"]
    D2 --> DB2["🗄️ PostgreSQL"]
    D3 --> DB3["🗄️ MySQL"]

    style F fill:#1e40af,color:#fff
    style D1 fill:#065f46,color:#fff
    style D2 fill:#065f46,color:#fff
    style D3 fill:#065f46,color:#fff
```

### 6. Diagrama del Modo Solo-Lectura

```mermaid
flowchart TD
    A["Acción recibida"] --> B{"readOnly = true<br/>en config.json?"}
    B -->|No| E["Ejecutar query sin restricción"]
    B -->|Sí| C{"¿SQL contiene<br/>INSERT, UPDATE, DELETE,<br/>DROP, ALTER, TRUNCATE,<br/>CREATE, EXEC, MERGE?"}
    C -->|Sí| D["❌ RECHAZADA<br/>'Modo solo-lectura activado'"]
    C -->|No| E
    E --> F["✅ Ejecutar contra BD"]

    style D fill:#dc2626,color:#fff
    style F fill:#16a34a,color:#fff
```

---

## Cómo instalar

### Servidor (en el VPS/Cloud)

```bash
cd agentstructure/server
cp .env.example .env           # Editar: API_KEY, PORT
cp agents.json.example agents.json  # Editar: agregar agentes y sus secrets
npm install
npm start
```

### Agente (en la red del cliente)

```bash
cd agentstructure/agent
cp config.json.example config.json  # Editar: clienteId, serverUrl, agentSecret, BD
# Personalizar queries.json según las tablas del cliente
npm install
npm start
```

---

## Ejemplo de petición desde la App

```bash
curl -X POST http://localhost:3500/query/empresa_abc \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: mi-clave-de-api" \
  -d '{ "action": "get_clientes", "params": {} }'
```

Respuesta:
```json
{
  "ok": true,
  "fromCache": false,
  "data": {
    "recordset": [
      { "IDCliente": "001", "razon_social": "Empresa ABC", ... }
    ],
    "rowsAffected": [248]
  }
}
```

---

## Ejemplo de Log de Auditoría

Archivo: `agent/logs/audit_2026-05-22.log`
```
[2026-05-22 09:15:23] ACTION: get_clientes | PARAMS: {} | STATUS: OK | ROWS: 248 | TIME: 134ms
[2026-05-22 09:15:45] ACTION: get_cuentas_cobrar_by_client | PARAMS: {"IdCliente":"005"} | STATUS: OK | ROWS: 3 | TIME: 89ms
[2026-05-22 09:16:02] ACTION: delete_all | PARAMS: {} | STATUS: ERROR | ERROR: Acción desconocida o no permitida: "delete_all" | TIME: 0ms
```
