/**
 * connector.js — Factory de conexión multi-motor de base de datos.
 *
 * PROPÓSITO:
 *   Abstrae el motor de base de datos detrás de una interfaz unificada.
 *   El agente llama a connector.executeQuery() sin saber si está hablando
 *   con SQL Server, PostgreSQL o MySQL. El motor se elige desde config.json.
 *
 * PATRÓN DE DISEÑO: Factory Pattern
 *   Según el valor de "dbEngine" en config.json, se carga el driver correcto:
 *     "mssql"    → drivers/mssqlDriver.js  (Microsoft SQL Server)
 *     "postgres" → drivers/pgDriver.js     (PostgreSQL)
 *     "mysql"    → drivers/mysqlDriver.js  (MySQL / MariaDB)
 *
 * INTERFAZ UNIFICADA:
 *   Todos los drivers implementan la misma firma:
 *     executeQuery(dbConfig, sql, params, paramTypes) → { recordset, recordsets, rowsAffected }
 *     closePool() → void
 */

// ─── Mapa de factories de drivers ────────────────────────────────────────────
// Usamos funciones lazy (arrow functions que devuelven require) para que solo
// se cargue en memoria el driver que realmente se necesita.
const DRIVER_FACTORIES = {
  mssql: () => require('./drivers/mssqlDriver'),
  postgres: () => require('./drivers/pgDriver'),
  mysql: () => require('./drivers/mysqlDriver'),
};

// Driver activo (se inicializa una sola vez)
let activeDriver = null;
let activeEngine = null;

/**
 * Obtiene el driver activo. Si no se ha inicializado, lo carga según el motor especificado.
 *
 * @param {string} engine - Motor de BD ("mssql", "postgres" o "mysql")
 * @returns {object} Driver con métodos executeQuery y closePool
 * @throws {Error} Si el motor no está soportado
 */
function getDriver(engine) {
  // Si ya tenemos un driver activo, lo devolvemos
  if (activeDriver && activeEngine === engine) return activeDriver;

  // Buscamos la factory para el motor solicitado
  const factory = DRIVER_FACTORIES[engine];
  if (!factory) {
    const supported = Object.keys(DRIVER_FACTORIES).join(', ');
    throw new Error(
      `Motor de base de datos no soportado: "${engine}". ` +
      `Motores disponibles: ${supported}. ` +
      `Verifica el campo "dbEngine" en tu config.json.`
    );
  }

  // Cargamos el driver
  activeDriver = factory();
  activeEngine = engine;
  console.log(`[Connector] Driver "${engine}" cargado.`);

  return activeDriver;
}

/**
 * Ejecuta una consulta SQL usando el driver apropiado.
 * Esta es la función que llama el agente. Internamente delega al driver correcto.
 *
 * @param {string} engine     - Motor de BD ("mssql", "postgres", "mysql")
 * @param {object} dbConfig   - Configuración de conexión del config.json
 * @param {string} sql        - Consulta SQL a ejecutar
 * @param {object} params     - Parámetros de la consulta
 * @param {object} paramTypes - Tipos de parámetros (del queryResolver)
 * @returns {Promise<{ recordset: Array, recordsets: Array, rowsAffected: number[] }>}
 */
async function executeQuery(engine, dbConfig, sql, params = {}, paramTypes = {}) {
  const driver = getDriver(engine);
  return driver.executeQuery(dbConfig, sql, params, paramTypes);
}

/**
 * Cierra el pool de conexiones del driver activo.
 * Se llama cuando el agente se está apagando (shutdown).
 */
async function closePool() {
  if (activeDriver) {
    await activeDriver.closePool();
    activeDriver = null;
    activeEngine = null;
    console.log('[Connector] Pool cerrado.');
  }
}

module.exports = { executeQuery, closePool };
