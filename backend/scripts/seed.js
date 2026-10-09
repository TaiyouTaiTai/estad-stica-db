// Carga el catálogo didáctico (catalogo.json) en la base de datos.
//
//   npm run seed                      → usa db/seed/catalogo.json del repo
//   npm run seed -- otro/catalogo.json
//
// Se puede correr las veces que quieras: actualiza lo existente (por `clave` y
// `termino`) en vez de duplicarlo, y no borra definiciones que ya tengan
// resultados guardados.
import fs from 'fs';
import path from 'path';
import pool, { enTransaccion } from '../src/config/db.js';
import { CATALOGO } from '../src/config/rutas.js';

const ruta = process.argv[2] ? path.resolve(process.argv[2]) : CATALOGO;

let catalogo;
try {
  catalogo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
} catch (err) {
  console.error(`❌ No se pudo leer ${ruta}: ${err.message}`);
  process.exit(1);
}

const { estadisticos = [], glosario = [] } = catalogo;

try {
  await enTransaccion(async (conn) => {
    for (const e of estadisticos) {
      await conn.execute(
        `INSERT INTO definicion_estadistico
           (clave, nombre, categoria, formula_latex, formula_texto, descripcion,
            cuando_usar, malinterpretacion, requiere_ordenado, requiere_agrupado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre), categoria = VALUES(categoria), formula_latex = VALUES(formula_latex),
           formula_texto = VALUES(formula_texto), descripcion = VALUES(descripcion),
           cuando_usar = VALUES(cuando_usar), malinterpretacion = VALUES(malinterpretacion),
           requiere_ordenado = VALUES(requiere_ordenado), requiere_agrupado = VALUES(requiere_agrupado)`,
        [
          e.clave, e.nombre, e.categoria, e.formula_latex, e.formula_texto ?? null, e.descripcion,
          e.cuando_usar ?? null, e.malinterpretacion ?? null, !!e.requiere_ordenado, !!e.requiere_agrupado
        ]
      );
      const [[{ id }]] = await conn.execute('SELECT id FROM definicion_estadistico WHERE clave = ?', [e.clave]);

      // Símbolos y escalas se reemplazan completos: así lo que borres del JSON también se borra aquí
      await conn.execute('DELETE FROM simbolo_formula WHERE definicion_id = ?', [id]);
      if (e.simbolos?.length) {
        await conn.query(
          'INSERT INTO simbolo_formula (definicion_id, simbolo_latex, significado, orden) VALUES ?',
          [e.simbolos.map((s, i) => [id, s.simbolo_latex, s.significado, s.orden ?? i + 1])]
        );
      }
      await conn.execute('DELETE FROM estadistico_escala WHERE definicion_id = ?', [id]);
      if (e.escalas?.length) {
        await conn.query(
          'INSERT INTO estadistico_escala (definicion_id, escala, permitido, motivo) VALUES ?',
          [e.escalas.map(s => [id, s.escala, !!s.permitido, s.motivo ?? null])]
        );
      }
    }

    for (const g of glosario) {
      await conn.execute(
        `INSERT INTO glosario (termino, definicion, ejemplo) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE definicion = VALUES(definicion), ejemplo = VALUES(ejemplo)`,
        [g.termino, g.definicion, g.ejemplo ?? null]
      );
    }
  });
  console.log(`✅ Catálogo cargado: ${estadisticos.length} estadísticos y ${glosario.length} términos del glosario`);
} catch (err) {
  console.error('❌ Error cargando el catálogo:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
