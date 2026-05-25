/**
 * queryResolver.js — Resolutor de Queries del Agente.
 *
 * PROPÓSITO:
 *   Este módulo es el corazón de la seguridad del agente. Se encarga de:
 *   1. Cargar las queries permitidas desde queries.json (lista blanca)
 *   2. Resolver un nombre de acción → consulta SQL
 *   3. Validar que los parámetros requeridos estén presentes
 *   4. Validar los TIPOS de los parámetros (int, string, float, etc.)
 *   5. Aplicar el modo SOLO LECTURA si está activado
 *
 * MODO SOLO LECTURA:
 *   Si config.json tiene "readOnly": true, CUALQUIER query que contenga
 *   palabras clave de escritura (INSERT, UPDATE, DELETE, DROP, etc.) es
 *   rechazada automáticamente. Esto garantiza por contrato que el sistema
 *   es de solo lectura, independientemente de lo que diga la query.
 *
 * TIPOS DE PARÁMETROS SOPORTADOS:
 *   int, string, varchar, float, decimal, boolean, bit, date, datetime
 */

const path = require('path');

// ─── Cargar la lista blanca de queries ───────────────────────────────────────
let QUERIES;
try {
  QUERIES = require(path.resolve(__dirname, '../queries.json'));
  // Eliminamos el campo de comentario si existe
  delete QUERIES['_comentario'];
  console.log(`[QueryResolver] Lista blanca cargada: ${Object.keys(QUERIES).length} acciones disponibles.`);
} catch (err) {
  console.error('[QueryResolver] FATAL: No se pudo leer queries.json.', err.message);
  process.exit(1);
}

// ─── Palabras clave de escritura (para modo solo-lectura) ────────────────────
// Regex que detecta operaciones que modifican datos o la estructura de la BD.
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE)\b/i;

// ─── Mapa de validadores de tipos ────────────────────────────────────────────
/**
 * Cada tipo tiene:
 *  - validate: función que verifica si el valor es del tipo correcto
 *  - sqlType:  nombre del tipo para pasar a los drivers de BD (usado por mssql)
 *
 * NOTA: Los validadores son permisivos por diseño. Si un valor puede convertirse
 * al tipo destino sin perder información, se acepta. Esto facilita el uso desde
 * aplicaciones que envían todo como string (ej. query params HTTP).
 */
const TYPE_VALIDATORS = {
  int: {
    validate: (v) => Number.isFinite(Number(v)) && Number.isInteger(Number(v)),
    sqlType: 'Int',
  },
  string: {
    validate: (v) => typeof v === 'string' || typeof v === 'number',
    sqlType: 'NVarChar',
  },
  varchar: {
    validate: (v) => typeof v === 'string' || typeof v === 'number',
    sqlType: 'NVarChar',
  },
  float: {
    validate: (v) => Number.isFinite(Number(v)),
    sqlType: 'Float',
  },
  decimal: {
    validate: (v) => Number.isFinite(Number(v)),
    sqlType: 'Decimal',
  },
  boolean: {
    validate: (v) => typeof v === 'boolean' || v === 0 || v === 1 || v === '0' || v === '1' || v === 'true' || v === 'false',
    sqlType: 'Bit',
  },
  bit: {
    validate: (v) => typeof v === 'boolean' || v === 0 || v === 1 || v === '0' || v === '1',
    sqlType: 'Bit',
  },
  date: {
    validate: (v) => !isNaN(Date.parse(v)),
    sqlType: 'Date',
  },
  datetime: {
    validate: (v) => !isNaN(Date.parse(v)),
    sqlType: 'DateTime',
  },
};

// ─── Funciones públicas ──────────────────────────────────────────────────────

/**
 * Devuelve la lista de nombres de todas las acciones disponibles.
 * Se usa para enviar el "Action Manifest" al servidor durante la autenticación.
 *
 * @returns {string[]} Array con los nombres de las acciones (ej. ['get_clientes', 'get_productos'])
 */
function getAvailableActions() {
  return Object.keys(QUERIES);
}

/**
 * Resuelve una acción a su definición SQL completa y valida todo.
 *
 * @param {string}  action   - Nombre de la acción (ej. 'get_clientes')
 * @param {object}  params   - Parámetros enviados por la App
 * @param {boolean} readOnly - Si es true, rechaza cualquier query de escritura
 *
 * @returns {{ success: true, sql: string, params: object, paramTypes: object }}
 *   En caso de éxito: devuelve el SQL, los params validados y los tipos para el driver.
 *
 * @returns {{ success: false, error: string }}
 *   En caso de error: devuelve un mensaje descriptivo del problema.
 */
function resolve(action, params = {}, readOnly = false) {
  // 1. ¿Existe la acción en la lista blanca?
  const queryDef = QUERIES[action];
  if (!queryDef) {
    return {
      success: false,
      error: `Acción desconocida o no permitida: "${action}". Acciones disponibles: ${getAvailableActions().join(', ')}`,
    };
  }

  // 2. MODO SOLO LECTURA: ¿La query intenta modificar datos?
  if (readOnly && WRITE_KEYWORDS.test(queryDef.sql)) {
    return {
      success: false,
      error: `Modo solo-lectura activado. La acción "${action}" contiene operaciones de escritura que están bloqueadas.`,
    };
  }

  // 3. Validar parámetros requeridos y tipos
  const definedParams = queryDef.params || {};
  const paramTypes = {}; // Acumulador de tipos para pasar al driver

  for (const [paramName, paramDef] of Object.entries(definedParams)) {
    // ¿Es requerido y no fue enviado?
    if (paramDef.required && !(paramName in params)) {
      return {
        success: false,
        error: `Falta el parámetro requerido "${paramName}" para la acción "${action}".`,
      };
    }

    // Si el parámetro fue enviado, validar su tipo
    if (paramName in params) {
      const validator = TYPE_VALIDATORS[paramDef.type];

      if (validator) {
        // Verificamos que el valor sea del tipo esperado
        if (!validator.validate(params[paramName])) {
          return {
            success: false,
            error: `El parámetro "${paramName}" debe ser de tipo "${paramDef.type}". Valor recibido: ${JSON.stringify(params[paramName])}`,
          };
        }

        // Guardamos el tipo SQL para que el driver pueda usarlo
        paramTypes[paramName] = {
          type: paramDef.type,
          sqlType: validator.sqlType,
        };
      }
    }
  }

  // 4. Todo validado correctamente — devolvemos el SQL y los datos listos para ejecutar
  return {
    success: true,
    sql: queryDef.sql,
    params,
    paramTypes,
  };
}

module.exports = { resolve, getAvailableActions };
