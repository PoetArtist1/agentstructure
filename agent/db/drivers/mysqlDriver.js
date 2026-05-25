/**
 * mysqlDriver.js — Driver para MySQL / MariaDB.
 *
 * Usa la librería 'mysql2' con Connection Pooling y Promises.
 *
 * CONVERSIÓN DE PARÁMETROS:
 *   Las queries en queries.json usan @NombreParametro (sintaxis de SQL Server).
 *   MySQL usa ? (marcadores posicionales) para queries parametrizadas.
 *   Este driver convierte automáticamente @Nombre → ? y arma el array de valores
 *   en el orden correcto.
 *
 * EJEMPLO DE CONVERSIÓN:
 *   SQL original:    "SELECT * FROM clientes WHERE id = @IdCliente AND activo = @Activo"
 *   SQL convertido:  "SELECT * FROM clientes WHERE id = ? AND activo = ?"
 *   Valores:         [valorIdCliente, valorActivo]
 */

const mysql = require('mysql2/promise');

// ─── Pool de conexiones ──────────────────────────────────────────────────────
let pool = null;

/**
 * Inicializa o reutiliza el pool de conexiones a MySQL/MariaDB.
 *
 * @param {object} dbConfig - Configuración de conexión desde config.json
 * @returns {import('mysql2/promise').Pool}
 */
function getPool(dbConfig) {
  if (pool) return pool;

  pool = mysql.createPool({
    host: dbConfig.server,
    port: dbConfig.port || 3306, // Puerto por defecto de MySQL
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    waitForConnections: true,
    connectionLimit: 10,    // Máximo de conexiones en el pool
    queueLimit: 0,          // Sin límite de cola de espera
    connectTimeout: dbConfig.options?.connectionTimeout ?? 15000,
  });

  console.log(`[MySQL] Pool creado para ${dbConfig.server}/${dbConfig.database}`);
  return pool;
}

/**
 * Convierte una query con parámetros @Nombre a la sintaxis de marcadores de MySQL (?).
 * Extrae los nombres de los parámetros en orden de aparición y construye el array de valores.
 *
 * @param {string} sql    - Query SQL con @NombreParametro
 * @param {object} params - Objeto con los valores { NombreParametro: valor }
 * @returns {{ sql: string, values: any[] }} Query convertida y array de valores en orden
 */
function convertToPlaceholders(sql, params) {
  // Encontramos todos los @NombreParametro en el SQL
  const matches = sql.match(/@(\w+)/g);
  if (!matches) return { sql, values: [] };

  // Deduplicamos los nombres manteniendo el orden de primera aparición
  const paramNames = [...new Set(matches.map((m) => m.slice(1)))];

  // Creamos el mapa de nombre → valor para poder reemplazar correctamente
  // cuando un parámetro aparece múltiples veces en la misma query
  const values = [];
  let convertedSql = sql;

  // Reemplazamos cada @NombreParametro por ? y guardamos el valor correspondiente
  // NOTA: Si un parámetro aparece múltiples veces, hay que agregar el valor cada vez
  convertedSql = sql.replace(/@(\w+)/g, (match, name) => {
    values.push(params[name]);
    return '?';
  });

  return { sql: convertedSql, values };
}

/**
 * Ejecuta una consulta SQL parametrizada contra MySQL/MariaDB.
 *
 * @param {object} dbConfig   - Configuración de conexión
 * @param {string} sqlQuery   - La consulta SQL con @NombreParametro
 * @param {object} params     - Valores de los parámetros
 * @param {object} paramTypes - Tipos de parámetros (no se usan en MySQL, pero se mantiene la interfaz)
 * @returns {Promise<{ recordset: Array, recordsets: Array, rowsAffected: number[] }>}
 */
async function executeQuery(dbConfig, sqlQuery, params = {}, paramTypes = {}) {
  const connectionPool = getPool(dbConfig);

  // Convertimos @NombreParametro → ?
  const { sql, values } = convertToPlaceholders(sqlQuery, params);

  // Ejecutamos la query. mysql2 devuelve [rows, fields]
  const [rows, fields] = await connectionPool.query(sql, values);

  // Devolvemos en el mismo formato que el driver de MSSQL para consistencia
  // Para SELECT, rows es un array de objetos. Para INSERT/UPDATE, rows es un ResultSetHeader.
  const isSelect = Array.isArray(rows);

  return {
    recordset: isSelect ? rows : [],
    recordsets: isSelect ? [rows] : [],
    rowsAffected: [isSelect ? rows.length : (rows.affectedRows || 0)],
  };
}

/**
 * Cierra todas las conexiones del pool.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[MySQL] Pool cerrado');
  }
}

module.exports = { executeQuery, closePool };
