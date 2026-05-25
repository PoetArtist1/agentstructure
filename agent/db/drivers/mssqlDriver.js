/**
 * mssqlDriver.js — Driver para Microsoft SQL Server.
 *
 * Usa la librería 'mssql' (oficial de Microsoft) con Connection Pooling.
 * Los parámetros se pasan con request.input() usando @NombreParametro,
 * que es la sintaxis nativa de SQL Server. Esto previene SQL Injection.
 *
 * TIPO DE PARÁMETROS:
 *   Si el queryResolver proporciona información de tipos (paramTypes),
 *   se usa request.input(nombre, sql.Tipo, valor) para mayor precisión.
 *   Si no hay tipo definido, mssql infiere el tipo automáticamente.
 */

const sql = require('mssql');

// ─── Pool de conexiones ──────────────────────────────────────────────────────
// Connection Pooling: mantiene varias conexiones abiertas listas para usarse.
// Crear una conexión nueva por cada query es muy lento.
let pool = null;
let poolPromise = null;

// ─── Mapa de tipos SQL ──────────────────────────────────────────────────────
// Traduce los nombres de tipo del queryResolver a tipos de la librería mssql.
const SQL_TYPES = {
  Int: sql.Int,
  NVarChar: sql.NVarChar,
  Float: sql.Float,
  Decimal: sql.Decimal(18, 4), // Precisión estándar para valores monetarios
  Bit: sql.Bit,
  Date: sql.Date,
  DateTime: sql.DateTime,
};

/**
 * Inicializa o reutiliza el pool de conexiones a SQL Server.
 *
 * @param {object} dbConfig - Configuración de conexión desde config.json
 * @returns {Promise<import('mssql').ConnectionPool>}
 */
async function getPool(dbConfig) {
  // Si el pool ya existe y está conectado, lo devolvemos al instante
  if (pool && pool.connected) return pool;
  // Si ya hay un intento de conexión en progreso, devolvemos la misma promesa
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    try {
      // Mapeamos la configuración de config.json al formato que pide mssql
      const config = {
        server: dbConfig.server,
        port: dbConfig.port || 1433,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: {
          encrypt: dbConfig.options?.encrypt ?? false,
          trustServerCertificate: dbConfig.options?.trustServerCertificate ?? true,
          requestTimeout: dbConfig.options?.requestTimeout ?? 30000,
          connectionTimeout: dbConfig.options?.connectionTimeout ?? 15000,
        },
        // Pool: mantiene al menos 2 conexiones abiertas, máximo 10
        pool: { max: 10, min: 2, idleTimeoutMillis: 60000 },
      };

      pool = await new sql.ConnectionPool(config).connect();

      // Si el pool pierde la conexión después (ej. se reinicia SQL Server)
      pool.on('error', (err) => {
        console.error('[MSSQL] Pool error:', err.message);
        pool = null;
        poolPromise = null;
      });

      console.log(`[MSSQL] Conectado a ${dbConfig.server}/${dbConfig.database}`);
      return pool;
    } catch (err) {
      pool = null;
      poolPromise = null;
      throw err;
    }
  })();

  return poolPromise;
}

/**
 * Ejecuta una consulta SQL parametrizada contra SQL Server.
 *
 * @param {object} dbConfig   - Configuración de conexión
 * @param {string} sqlQuery   - La consulta SQL (ej. "SELECT * FROM Clientes WHERE Id = @Id")
 * @param {object} params     - Valores de los parámetros (ej. { Id: 5 })
 * @param {object} paramTypes - Tipos de parámetros del queryResolver (ej. { Id: { sqlType: 'Int' } })
 * @returns {Promise<{ recordset: Array, recordsets: Array, rowsAffected: number[] }>}
 */
async function executeQuery(dbConfig, sqlQuery, params = {}, paramTypes = {}) {
  const connectionPool = await getPool(dbConfig);
  const request = connectionPool.request();

  // Asignamos los parámetros al request.
  // Si tenemos información de tipo del queryResolver, la usamos para mayor precisión.
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      const typeInfo = paramTypes[key];

      if (typeInfo?.sqlType && SQL_TYPES[typeInfo.sqlType]) {
        // Con tipo explícito: request.input('Id', sql.Int, 5)
        request.input(key, SQL_TYPES[typeInfo.sqlType], value);
      } else {
        // Sin tipo: mssql infiere automáticamente (menos preciso pero funcional)
        request.input(key, value);
      }
    }
  }

  const result = await request.query(sqlQuery);

  return {
    recordset: result.recordset || [],
    recordsets: result.recordsets || [],
    rowsAffected: result.rowsAffected || [],
  };
}

/**
 * Cierra todas las conexiones del pool.
 * Se llama cuando el agente se está apagando.
 */
async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
    console.log('[MSSQL] Pool cerrado');
  }
}

module.exports = { executeQuery, closePool };
