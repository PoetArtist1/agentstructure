/**
 * pgDriver.js — Driver para PostgreSQL.
 *
 * Usa la librería 'pg' (node-postgres) con Connection Pooling.
 *
 * CONVERSIÓN DE PARÁMETROS:
 *   Las queries en queries.json usan @NombreParametro (sintaxis de SQL Server).
 *   PostgreSQL usa $1, $2, $3... (sintaxis posicional).
 *   Este driver convierte automáticamente @Nombre → $N y arma el array de valores
 *   en el orden correcto.
 *
 * EJEMPLO DE CONVERSIÓN:
 *   SQL original:    "SELECT * FROM clientes WHERE id = @IdCliente AND activo = @Activo"
 *   SQL convertido:  "SELECT * FROM clientes WHERE id = $1 AND activo = $2"
 *   Valores:         [valorIdCliente, valorActivo]
 */

const { Pool } = require('pg');

// ─── Pool de conexiones ──────────────────────────────────────────────────────
let pool = null;

/**
 * Inicializa o reutiliza el pool de conexiones a PostgreSQL.
 *
 * @param {object} dbConfig - Configuración de conexión desde config.json
 * @returns {import('pg').Pool}
 */
function getPool(dbConfig) {
  if (pool) return pool;

  pool = new Pool({
    host: dbConfig.server,
    port: dbConfig.port || 5432, // Puerto por defecto de PostgreSQL
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    max: 10,               // Máximo de conexiones en el pool
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: dbConfig.options?.connectionTimeout ?? 15000,
  });

  // Manejamos errores del pool para que no se caiga la aplicación
  pool.on('error', (err) => {
    console.error('[PostgreSQL] Pool error inesperado:', err.message);
  });

  console.log(`[PostgreSQL] Pool creado para ${dbConfig.server}/${dbConfig.database}`);
  return pool;
}

/**
 * Convierte una query con parámetros @Nombre a la sintaxis posicional de PostgreSQL ($1, $2...).
 * Extrae los nombres de los parámetros en orden de aparición y construye el array de valores.
 *
 * @param {string} sql    - Query SQL con @NombreParametro
 * @param {object} params - Objeto con los valores { NombreParametro: valor }
 * @returns {{ sql: string, values: any[] }} Query convertida y array de valores en orden
 */
function convertToPositional(sql, params) {
  // Encontramos todos los @NombreParametro en el SQL
  const matches = sql.match(/@(\w+)/g);
  if (!matches) return { sql, values: [] };

  // Deduplicamos los nombres manteniendo el orden de primera aparición
  const paramNames = [...new Set(matches.map((m) => m.slice(1)))];
  const values = [];

  let convertedSql = sql;
  paramNames.forEach((name, index) => {
    // Reemplazamos @NombreParametro por $N (ej. @IdCliente → $1)
    // Usamos word boundary (\b) para no reemplazar partes de otros nombres
    convertedSql = convertedSql.replace(new RegExp(`@${name}\\b`, 'g'), `$${index + 1}`);
    values.push(params[name]);
  });

  return { sql: convertedSql, values };
}

/**
 * Ejecuta una consulta SQL parametrizada contra PostgreSQL.
 *
 * @param {object} dbConfig   - Configuración de conexión
 * @param {string} sqlQuery   - La consulta SQL con @NombreParametro
 * @param {object} params     - Valores de los parámetros
 * @param {object} paramTypes - Tipos de parámetros (no se usan en pg, pero se mantiene la interfaz)
 * @returns {Promise<{ recordset: Array, recordsets: Array, rowsAffected: number[] }>}
 */
async function executeQuery(dbConfig, sqlQuery, params = {}, paramTypes = {}) {
  const connectionPool = getPool(dbConfig);

  // Convertimos @NombreParametro → $N
  const { sql, values } = convertToPositional(sqlQuery, params);

  // Ejecutamos la query
  const result = await connectionPool.query(sql, values);

  // Devolvemos en el mismo formato que el driver de MSSQL para consistencia
  return {
    recordset: result.rows || [],
    recordsets: [result.rows || []],
    rowsAffected: [result.rowCount || 0],
  };
}

/**
 * Cierra todas las conexiones del pool.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Pool cerrado');
  }
}

module.exports = { executeQuery, closePool };
