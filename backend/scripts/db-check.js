// Comprueba que el backend puede conectarse a MySQL con los datos del .env.
//   npm run db:check
import pool from '../src/config/db.js';
import { env } from '../src/config/env.js';

try {
  await pool.query('SELECT 1');
  console.log(`✅ Conexión a MySQL exitosa (${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME})`);
} catch (err) {
  console.error(`❌ Error de conexión: ${err.code ?? ''} ${err.message}`);
  if (err.code === 'ER_BAD_DB_ERROR') console.error('   La base de datos no existe todavía: ejecuta `npm run migrate`.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
