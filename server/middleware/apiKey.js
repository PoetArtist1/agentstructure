/**
 * apiKey.js — Middleware de autenticación para la capa HTTP (App → Servidor).
 *
 * PROPÓSITO:
 *   Protege todos los endpoints bajo /query/* para que solo las aplicaciones
 *   que conozcan la API Key puedan hacer peticiones al servidor.
 *   Sin este middleware, cualquier persona con la URL podría consultar datos.
 *
 * USO:
 *   La App debe enviar el header "X-Api-Key" con el valor configurado en el .env del servidor.
 *
 * EJEMPLO DE PETICIÓN:
 *   POST /query/empresa_abc
 *   Headers: { "X-Api-Key": "mi-clave-secreta", "Content-Type": "application/json" }
 *   Body:    { "action": "get_clientes", "params": {} }
 */

/**
 * Middleware Express que valida la API Key en cada petición HTTP.
 * Lee la clave esperada de la variable de entorno API_KEY.
 * Si no coincide o no se envía, responde con 401 (Unauthorized).
 *
 * @param {import('express').Request}  req  - Petición HTTP entrante
 * @param {import('express').Response} res  - Respuesta HTTP
 * @param {import('express').NextFunction} next - Siguiente middleware en la cadena
 */
function apiKeyAuth(req, res, next) {
  // Leemos la API Key esperada del entorno del servidor
  const expectedKey = process.env.API_KEY;

  // Si no se configuró una API Key en el .env, rechazamos todo por seguridad.
  // Esto evita que el servidor arranque "abierto" por accidente.
  if (!expectedKey) {
    console.error('[Auth] FATAL: No se configuró API_KEY en el archivo .env. Todas las peticiones serán rechazadas.');
    return res.status(500).json({
      ok: false,
      error: 'El servidor no tiene configurada una API Key. Contacte al administrador.',
    });
  }

  // Leemos la clave que envió la App en el header
  const providedKey = req.headers['x-api-key'];

  // Validamos que exista y que coincida
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      ok: false,
      error: 'API Key inválida o ausente. Envíe el header X-Api-Key con la clave correcta.',
    });
  }

  // La clave es correcta, dejamos pasar la petición al siguiente handler
  next();
}

module.exports = apiKeyAuth;
