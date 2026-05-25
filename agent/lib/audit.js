/**
 * audit.js — Módulo de Auditoría / Log de Accesos del Agente.
 *
 * PROPÓSITO:
 *   Registra en archivos de texto plano cada acción que se ejecuta en el agente.
 *   Esto permite a la empresa saber QUIÉN pidió QUÉ dato y CUÁNDO.
 *   Es un requisito fundamental de trazabilidad para entornos empresariales.
 *
 * FORMATO DEL LOG:
 *   [YYYY-MM-DD HH:mm:ss] ACTION: nombre_accion | PARAMS: {...} | STATUS: OK/ERROR | ROWS: N | TIME: Xms
 *
 * ARCHIVOS:
 *   Se crea un archivo por día: logs/audit_2024-01-15.log
 *   Los archivos se acumulan en la carpeta "logs/" del agente.
 *   La empresa puede archivarlos, rotarlos o enviarlos a un sistema centralizado.
 *
 * NOTA DE SEGURIDAD:
 *   Los parámetros se registran para trazabilidad completa.
 *   Si se manejan datos sensibles (ej. contraseñas), considere filtrarlos antes de loguear.
 */

const fs = require('fs');
const path = require('path');

// Directorio donde se guardan los archivos de auditoría
const LOG_DIR = path.resolve(__dirname, '../logs');

/**
 * Asegura que el directorio de logs exista.
 * Se llama automáticamente la primera vez que se escribe un log.
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[Audit] Directorio de logs creado: ${LOG_DIR}`);
  }
}

/**
 * Registra una entrada de auditoría en el archivo del día.
 *
 * @param {object} entry - Datos de la acción a registrar
 * @param {string} entry.action - Nombre de la acción ejecutada (ej. 'get_clientes')
 * @param {object} entry.params - Parámetros enviados con la acción
 * @param {string} entry.status - Estado del resultado: 'OK' o 'ERROR'
 * @param {number} [entry.rows] - Número de filas devueltas (solo para status OK)
 * @param {number} entry.timeMs - Tiempo de ejecución en milisegundos
 * @param {string} [entry.error] - Mensaje de error (solo para status ERROR)
 */
function log(entry) {
  try {
    ensureLogDir();

    const now = new Date();
    // Formato de fecha: YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];
    // Formato de hora: HH:mm:ss
    const timeStr = now.toTimeString().split(' ')[0];

    // Nombre del archivo: audit_2024-01-15.log
    const logFile = path.join(LOG_DIR, `audit_${dateStr}.log`);

    // Construir la línea de log
    let line = `[${dateStr} ${timeStr}] ACTION: ${entry.action}`;
    line += ` | PARAMS: ${JSON.stringify(entry.params || {})}`;
    line += ` | STATUS: ${entry.status}`;

    if (entry.status === 'OK') {
      line += ` | ROWS: ${entry.rows ?? '-'}`;
    } else {
      line += ` | ERROR: ${entry.error || 'desconocido'}`;
    }

    line += ` | TIME: ${entry.timeMs}ms`;
    line += '\n';

    // Escribimos al final del archivo (append). Si no existe, se crea automáticamente.
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (err) {
    // Si falla el logging, no queremos que se caiga el agente entero.
    // Solo avisamos por consola.
    console.error('[Audit] Error al escribir log de auditoría:', err.message);
  }
}

module.exports = { log };
