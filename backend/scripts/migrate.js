// Aplica las migraciones de db/migrations/ que todavía no estén en `_migraciones`.
//
//   npm run migrate                → crea la base si no existe y aplica las pendientes
//   npm run migrate -- --estado    → solo muestra cuáles están aplicadas y cuáles no
//   npm run migrate -- --baseline  → marca TODAS como aplicadas sin ejecutarlas
//                                    (para una base creada antes con schema.sql)
//
// Cada migración se ejecuta completa y luego se registra. Ojo: en MySQL los
// CREATE/ALTER no se pueden deshacer con rollback, así que si una migración
// falla a la mitad, revisa a mano qué alcanzó a aplicarse antes de reintentar.
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { DIR_MIGRACIONES } from '../src/config/rutas.js';

const args = process.argv.slice(2);
const soloEstado = args.includes('--estado');
const baseline = args.includes('--baseline');

const NOMBRE_VALIDO = /^\d{3}_[a-z0-9_]+\.sql$/;

const archivos = fs.readdirSync(DIR_MIGRACIONES).filter(f => f.endsWith('.sql')).sort();
const malos = archivos.filter(f => !NOMBRE_VALIDO.test(f));
if (malos.length) {
  console.error(`❌ Nombres de migración inválidos (usa 002_descripcion_corta.sql): ${malos.join(', ')}`);
  process.exit(1);
}

// Una migración con `USE otra_base;` se aplicaría en la base equivocada
function revisarUse(archivo, sql) {
  for (const [, nombre] of sql.matchAll(/^\s*USE\s+`?(\w+)`?\s*;/gim)) {
    if (nombre !== env.DB_NAME) {
      throw new Error(`${archivo} hace "USE ${nombre}" pero DB_NAME en .env es "${env.DB_NAME}"`);
    }
  }
}

let conn;
try {
  conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    multipleStatements: true // una migración es un archivo con varias sentencias
  });
} catch (err) {
  console.error(`❌ No se pudo conectar a MySQL en ${env.DB_HOST}:${env.DB_PORT} (${err.code ?? err.message}). ¿Está encendido y el .env es correcto?`);
  process.exit(1);
}

try {
  const base = conn.escapeId(env.DB_NAME);
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${base} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE ${base}`);

  const [tablas] = await conn.query(
    'SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = ?',
    [env.DB_NAME]
  );
  const nombres = tablas.map(t => t.nombre);
  const tieneHistorial = nombres.includes('_migraciones');

  // Base con tablas pero sin historial: se creó a mano o con un schema.sql antiguo.
  // Aplicar 001 fallaría ("la tabla ya existe"), así que se pide una decisión explícita.
  if (!tieneHistorial && nombres.length > 0 && !baseline) {
    console.error(`❌ La base "${env.DB_NAME}" ya tiene tablas pero no tiene historial de migraciones.`);
    console.error('   Si la creaste con db/schema.sql y está al día, ejecuta: npm run migrate -- --baseline');
    process.exitCode = 1;
  } else {
    await conn.query(`CREATE TABLE IF NOT EXISTS _migraciones (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      archivo     VARCHAR(120) NOT NULL UNIQUE,
      aplicada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [filas] = await conn.query('SELECT archivo FROM _migraciones');
    const aplicadas = new Set(filas.map(f => f.archivo));
    const pendientes = archivos.filter(f => !aplicadas.has(f));

    if (baseline) {
      for (const f of pendientes) await conn.query('INSERT IGNORE INTO _migraciones (archivo) VALUES (?)', [f]);
      console.log(`✅ Marcadas como aplicadas sin ejecutarlas: ${pendientes.join(', ') || '(ninguna)'}`);
    } else if (soloEstado) {
      for (const f of archivos) console.log(`${aplicadas.has(f) ? '✅' : '⏳'} ${f}`);
      const huerfanas = [...aplicadas].filter(f => !archivos.includes(f));
      if (huerfanas.length) console.log(`⚠️  Registradas en la base pero sin archivo: ${huerfanas.join(', ')}`);
    } else if (pendientes.length === 0) {
      console.log(`✅ La base "${env.DB_NAME}" está al día (${archivos.length} migraciones)`);
    } else {
      for (const f of pendientes) {
        const sql = fs.readFileSync(path.join(DIR_MIGRACIONES, f), 'utf8');
        try {
          revisarUse(f, sql);
          await conn.query(sql);
          // Las migraciones se registran solas, pero por si alguna lo olvida:
          await conn.query('INSERT IGNORE INTO _migraciones (archivo) VALUES (?)', [f]);
          console.log(`✅ ${f}`);
        } catch (err) {
          console.error(`❌ ${f}: ${err.message}`);
          console.error('   Las migraciones siguientes no se aplicaron. Revisa la base antes de reintentar.');
          process.exitCode = 1;
          break;
        }
      }
    }
  }
} finally {
  await conn.end();
}
