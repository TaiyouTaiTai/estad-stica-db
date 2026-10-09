import app from './app.js';
import pool from './config/db.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${env.PORT}`);
  console.log(`🔌 Base de datos: ${env.DB_NAME} en ${env.DB_HOST}:${env.DB_PORT}`);
});

// Apagado ordenado: deja terminar las peticiones en curso y cierra la conexión a MySQL
function apagar(senal) {
  console.log(`\n${senal} recibido, cerrando…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
