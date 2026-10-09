import { HttpError } from '../lib/errores.js';
import { ErrorCalculo } from '../calculos/helpers.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Errores esperados (los lanzamos nosotros a propósito)
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.detalles && { detalles: err.detalles }) });
  }

  // Un cálculo que no se puede hacer con estos datos (ej. muy pocos datos)
  if (err instanceof ErrorCalculo) {
    return res.status(422).json({ error: err.message });
  }

  // Validación de Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message }))
    });
  }

  // JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Los datos enviados son demasiado grandes' });
  }

  // Multer (subida de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido' });
  }

  // MySQL caído o inaccesible: no es culpa del usuario, que reintente más tarde
  if (['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(err.code)) {
    console.error(`Base de datos no disponible: ${err.code}`);
    return res.status(503).json({ error: 'La base de datos no está disponible en este momento' });
  }

  // Cualquier otra cosa es un error nuestro: se registra completo en el
  // servidor, pero al cliente no se le filtran detalles internos (SQL, rutas…).
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
