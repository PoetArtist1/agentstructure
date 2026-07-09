#!/usr/bin/env node

/**
 * install.js — Instalador interactivo de AgentStructure.
 *
 * PROPÓSITO:
 *   Script cross-platform (Windows/Linux/Mac) que guía al usuario paso a paso
 *   para configurar ya sea el Servidor Central o el Agente On-Premise.
 *   Genera automáticamente todos los archivos de configuración necesarios
 *   y ejecuta npm install.
 *
 * USO:
 *   node install.js
 *
 * FLUJO:
 * 
 *   1. Pregunta: ¿Instalar Agente o Servidor?
 *   2. Solicita los datos de configuración necesarios
 *   3. Genera los archivos de configuración (.env, agents.json, config.json)
 *   4. Ejecuta npm install en la carpeta correspondiente
 *   5. Muestra instrucciones para arrancar
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Colores para la consola ─────────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const c = colors;

// ─── Interfaz de lectura ─────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Pregunta al usuario y espera su respuesta.
 * @param {string} question - La pregunta a mostrar
 * @param {string} [defaultVal] - Valor por defecto si el usuario presiona Enter sin escribir
 * @returns {Promise<string>}
 */
function ask(question, defaultVal) {
  const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : '';
  return new Promise((resolve) => {
    rl.question(`${c.cyan}  → ${c.reset}${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

/**
 * Pregunta al usuario por una contraseña (no se oculta en terminal por simplicidad).
 * @param {string} question - La pregunta a mostrar
 * @returns {Promise<string>}
 */
function askPassword(question) {
  return new Promise((resolve) => {
    rl.question(`${c.cyan}  → ${c.reset}${question}: `, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Muestra un encabezado decorativo.
 */
function header(text) {
  console.log(`\n${c.blue}  ── ${c.bright}${text}${c.reset}${c.blue} ──${c.reset}\n`);
}

/**
 * Muestra un mensaje de éxito.
 */
function success(text) {
  console.log(`${c.green}  ✔ ${text}${c.reset}`);
}

/**
 * Muestra un mensaje de información.
 */
function info(text) {
  console.log(`${c.dim}  ℹ ${text}${c.reset}`);
}

// ─── Función principal ───────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(`${c.bright}${c.blue}  ╔═══════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bright}${c.blue}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.blue}  ║${c.reset}${c.bright}${c.cyan}       🔗 AgentStructure — Instalador Interactivo          ${c.reset}${c.bright}${c.blue}║${c.reset}`);
  console.log(`${c.bright}${c.blue}  ║${c.reset}${c.dim}       Túnel inverso seguro para bases de datos           ${c.reset}${c.bright}${c.blue}║${c.reset}`);
  console.log(`${c.bright}${c.blue}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.blue}  ╚═══════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');

  console.log(`  ${c.bright}¿Qué desea instalar?${c.reset}`);
  console.log('');
  console.log(`  ${c.cyan}[1]${c.reset} 🤖 Agente On-Premise  ${c.dim}(se instala en la red del cliente, junto a la BD)${c.reset}`);
  console.log(`  ${c.cyan}[2]${c.reset} 🌐 Servidor Central   ${c.dim}(se instala en el VPS/Cloud)${c.reset}`);
  console.log('');

  const choice = await ask('Seleccione una opción', '1');

  if (choice === '1') {
    await installAgent();
  } else if (choice === '2') {
    await installServer();
  } else {
    console.log(`\n${c.red}  ✘ Opción inválida. Use 1 o 2.${c.reset}\n`);
    rl.close();
    return;
  }

  rl.close();
}

// ─── Instalación del Agente ──────────────────────────────────────────────────
async function installAgent() {
  header('Configuración del Agente On-Premise');

  info('El agente se conecta al servidor central y ejecuta queries contra su base de datos local.');
  info('Necesitará: URL del servidor, credenciales del agente y datos de conexión a la BD.\n');

  // ── Datos del agente ──
  const clienteId = await ask('ID de este agente/empresa (ej. empresa_abc)');
  if (!clienteId) {
    console.log(`\n${c.red}  ✘ El ID del agente es obligatorio.${c.reset}\n`);
    return;
  }

  const serverUrl = await ask('URL del servidor central (ej. wss://mi-servidor.com/ws)');
  if (!serverUrl) {
    console.log(`\n${c.red}  ✘ La URL del servidor es obligatoria.${c.reset}\n`);
    return;
  }

  const agentSecret = await askPassword('Secret de este agente (debe coincidir con agents.json del servidor)');
  if (!agentSecret) {
    console.log(`\n${c.red}  ✘ El secret es obligatorio.${c.reset}\n`);
    return;
  }

  // ── Modo solo-lectura ──
  console.log('');
  info('El modo solo-lectura bloquea cualquier query que modifique datos (INSERT, UPDATE, DELETE, etc.)');
  const readOnlyAnswer = await ask('¿Activar modo solo-lectura? (s/n)', 's');
  const readOnly = readOnlyAnswer.toLowerCase() === 's' || readOnlyAnswer.toLowerCase() === 'si';

  // ── Motor de base de datos ──
  header('Motor de Base de Datos');
  console.log(`  ${c.cyan}[1]${c.reset} Microsoft SQL Server  ${c.dim}(mssql)${c.reset}`);
  console.log(`  ${c.cyan}[2]${c.reset} PostgreSQL            ${c.dim}(postgres)${c.reset}`);
  console.log(`  ${c.cyan}[3]${c.reset} MySQL / MariaDB       ${c.dim}(mysql)${c.reset}`);
  console.log('');

  const engineChoice = await ask('Seleccione el motor de BD', '1');
  const engineMap = { '1': 'mssql', '2': 'postgres', '3': 'mysql' };
  const portMap = { '1': 1433, '2': 5432, '3': 3306 };
  const dbEngine = engineMap[engineChoice] || 'mssql';
  const defaultPort = portMap[engineChoice] || 1433;

  // ── Credenciales de la BD ──
  header('Conexión a la Base de Datos');

  const dbServer = await ask('Servidor de BD (host)', 'localhost');
  const dbPort = await ask(`Puerto de BD`, String(defaultPort));
  const dbDatabase = await ask('Nombre de la base de datos');
  const dbUser = await ask('Usuario de BD');
  const dbPassword = await askPassword('Contraseña de BD');

  if (!dbDatabase || !dbUser || !dbPassword) {
    console.log(`\n${c.red}  ✘ Los datos de conexión a la BD son obligatorios.${c.reset}\n`);
    return;
  }

  // ── Generar config.json ──
  header('Generando archivos de configuración');

  const agentConfig = {
    clienteId,
    serverUrl,
    agentSecret,
    readOnly,
    reconnect: {
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    dbEngine,
    db: {
      server: dbServer,
      port: parseInt(dbPort, 10),
      database: dbDatabase,
      user: dbUser,
      password: dbPassword,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 30000,
        connectionTimeout: 15000,
      },
    },
  };

  const agentDir = path.resolve(__dirname, 'agent');
  const configPath = path.join(agentDir, 'config.json');

  fs.writeFileSync(configPath, JSON.stringify(agentConfig, null, 2), 'utf8');
  success(`config.json generado en: ${configPath}`);

  // ── Crear directorio de logs ──
  const logsDir = path.join(agentDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    success('Directorio de logs creado: agent/logs/');
  }

  // ── npm install ──
  header('Instalando dependencias');
  info('Ejecutando npm install en agent/... (esto puede tardar un momento)');
  console.log('');

  try {
    execSync('npm install', {
      cwd: agentDir,
      stdio: 'inherit',
    });
    success('Dependencias instaladas correctamente.');
  } catch (err) {
    console.log(`\n${c.red}  ✘ Error al instalar dependencias: ${err.message}${c.reset}`);
    console.log(`${c.yellow}  Intente ejecutar manualmente: cd agent && npm install${c.reset}\n`);
  }

  // ── Instrucciones finales ──
  console.log('');
  console.log(`${c.bright}${c.green}  ╔═══════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bright}${c.green}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.green}  ║${c.reset}${c.bright}       ✅ Agente instalado exitosamente                    ${c.reset}${c.bright}${c.green}║${c.reset}`);
  console.log(`${c.bright}${c.green}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.green}  ╚═══════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}Para iniciar el agente:${c.reset}`);
  console.log(`  ${c.cyan}  cd agent${c.reset}`);
  console.log(`  ${c.cyan}  npm start${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}Para desarrollo (auto-restart):${c.reset}`);
  console.log(`  ${c.cyan}  cd agent${c.reset}`);
  console.log(`  ${c.cyan}  npm run dev${c.reset}`);
  console.log('');
  info('Recuerde personalizar queries.json con las consultas de su base de datos.');
  console.log('');
}

// ─── Instalación del Servidor ────────────────────────────────────────────────
async function installServer() {
  header('Configuración del Servidor Central');

  info('El servidor actúa como intermediario entre las Apps y los Agentes on-premise.');
  info('Necesitará: puerto, API Key, y datos de los agentes autorizados.\n');

  // ── Datos del servidor ──
  const port = await ask('Puerto del servidor', '3500');
  const apiKey = await ask('API Key para autenticar las Apps (o presione Enter para generar una)');

  // Si no proporcionó API Key, generamos una aleatoria
  let finalApiKey = apiKey;
  if (!finalApiKey) {
    finalApiKey = require('crypto').randomBytes(32).toString('hex');
    success(`API Key generada: ${finalApiKey}`);
    info('Guarde esta clave. Las Apps deberán enviarla en el header X-Api-Key.');
  }

  const timeoutMs = await ask('Timeout de respuesta del agente (ms)', '30000');

  // ── Registrar agentes ──
  header('Registro de Agentes Autorizados');
  info('Cada agente necesita un ID único y un secret.');
  info('Puede registrar múltiples agentes ahora.\n');

  const agents = {};
  let addMore = true;
  let agentCount = 0;

  while (addMore) {
    agentCount++;
    console.log(`  ${c.bright}Agente #${agentCount}:${c.reset}`);

    const agentId = await ask('  ID del agente (ej. empresa_abc)');
    if (!agentId) {
      console.log(`${c.yellow}  ⚠ ID vacío, se omite este agente.${c.reset}\n`);
      break;
    }

    const agentSecret = await ask('  Secret del agente (o Enter para generar)');
    let finalSecret = agentSecret;
    if (!finalSecret) {
      finalSecret = require('crypto').randomBytes(16).toString('hex');
      success(`  Secret generado para "${agentId}": ${finalSecret}`);
    }

    const agentDesc = await ask('  Descripción (opcional)', `Agente ${agentId}`);

    agents[agentId] = {
      secret: finalSecret,
      description: agentDesc,
    };

    success(`  Agente "${agentId}" registrado.\n`);

    const moreAnswer = await ask('¿Registrar otro agente? (s/n)', 'n');
    addMore = moreAnswer.toLowerCase() === 's' || moreAnswer.toLowerCase() === 'si';
    console.log('');
  }

  if (Object.keys(agents).length === 0) {
    console.log(`\n${c.red}  ✘ Debe registrar al menos un agente.${c.reset}\n`);
    return;
  }

  // ── Generar archivos de configuración ──
  header('Generando archivos de configuración');

  const serverDir = path.resolve(__dirname, 'server');

  // .env
  const envContent = [
    `# Generado por el instalador de AgentStructure`,
    `PORT=${port}`,
    `API_KEY=${finalApiKey}`,
    `QUERY_TIMEOUT_MS=${timeoutMs}`,
    `# CACHE_DEFAULT_TTL=60  # Descomenta para activar caché (en segundos)`,
  ].join('\n');

  const envPath = path.join(serverDir, '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');
  success(`.env generado en: ${envPath}`);

  // agents.json
  const agentsPath = path.join(serverDir, 'agents.json');
  fs.writeFileSync(agentsPath, JSON.stringify(agents, null, 2), 'utf8');
  success(`agents.json generado en: ${agentsPath}`);
  info(`${Object.keys(agents).length} agente(s) registrado(s).`);

  // ── npm install ──
  header('Instalando dependencias');
  info('Ejecutando npm install en server/... (esto puede tardar un momento)');
  console.log('');

  try {
    execSync('npm install', {
      cwd: serverDir,
      stdio: 'inherit',
    });
    success('Dependencias instaladas correctamente.');
  } catch (err) {
    console.log(`\n${c.red}  ✘ Error al instalar dependencias: ${err.message}${c.reset}`);
    console.log(`${c.yellow}  Intente ejecutar manualmente: cd server && npm install${c.reset}\n`);
  }

  // ── Instrucciones finales ──
  console.log('');
  console.log(`${c.bright}${c.green}  ╔═══════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bright}${c.green}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.green}  ║${c.reset}${c.bright}       ✅ Servidor instalado exitosamente                  ${c.reset}${c.bright}${c.green}║${c.reset}`);
  console.log(`${c.bright}${c.green}  ║                                                           ║${c.reset}`);
  console.log(`${c.bright}${c.green}  ╚═══════════════════════════════════════════════════════════╝${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}Datos importantes:${c.reset}`);
  console.log(`  ${c.cyan}  API Key:  ${c.reset}${finalApiKey}`);
  console.log(`  ${c.cyan}  Puerto:   ${c.reset}${port}`);
  console.log(`  ${c.cyan}  Agentes:  ${c.reset}${Object.keys(agents).join(', ')}`);
  console.log('');
  console.log(`  ${c.bright}Para iniciar el servidor:${c.reset}`);
  console.log(`  ${c.cyan}  cd server${c.reset}`);
  console.log(`  ${c.cyan}  npm start${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}Para desarrollo (auto-restart):${c.reset}`);
  console.log(`  ${c.cyan}  cd server${c.reset}`);
  console.log(`  ${c.cyan}  npm run dev${c.reset}`);
  console.log('');
  info('Comparta los secrets generados con los administradores de cada agente.');
  console.log('');
}

// ─── Ejecutar ────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error(`\n${c.red}  ✘ Error inesperado: ${err.message}${c.reset}\n`);
  rl.close();
  process.exit(1);
});
