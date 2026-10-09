// Revisa que db/ y backend/ sigan alineados. Es la red de seguridad del
// monorepo: si alguien agrega una migración o cambia el catálogo y olvida
// el otro lado, esta prueba falla antes de llegar a producción.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { DIR_MIGRACIONES, CATALOGO, RAIZ_REPO } from '../src/config/rutas.js';
import { ESTADISTICOS } from '../src/calculos/index.js';

const migraciones = fs.readdirSync(DIR_MIGRACIONES).filter(f => f.endsWith('.sql')).sort();
const schema = fs.readFileSync(`${RAIZ_REPO}db/schema.sql`, 'utf8');

describe('migraciones', () => {
  test('los nombres siguen el formato 000_descripcion.sql y los números no se repiten', () => {
    for (const f of migraciones) assert.match(f, /^\d{3}_[a-z0-9_]+\.sql$/);
    const numeros = migraciones.map(f => f.slice(0, 3));
    assert.equal(new Set(numeros).size, numeros.length, 'hay dos migraciones con el mismo número');
  });

  test('schema.sql registra todas las migraciones (regla del db/README)', () => {
    const faltan = migraciones.filter(f => !schema.includes(`('${f}')`));
    assert.deepEqual(faltan, [], 'Agrega estas migraciones al INSERT INTO _migraciones del final de schema.sql');
  });

  test('cada tabla creada en las migraciones existe en schema.sql', () => {
    const tablasSchema = new Set([...schema.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/g)].map(m => m[1]));
    for (const f of migraciones) {
      const sql = fs.readFileSync(DIR_MIGRACIONES + f, 'utf8');
      for (const [, tabla] of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/g)) {
        assert.ok(tablasSchema.has(tabla), `${f} crea "${tabla}" pero schema.sql no la tiene`);
      }
    }
  });
});

describe('catálogo didáctico', () => {
  const catalogo = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
  const categorias = schema.match(/categoria\s+ENUM\(([^)]+)\)/)[1].match(/'(\w+)'/g).map(s => s.slice(1, -1));
  const ESCALAS = ['nominal', 'ordinal', 'intervalo', 'razon'];

  test('todo lo que el backend sabe calcular tiene su definición en el catálogo', () => {
    const claves = new Set(catalogo.estadisticos.map(e => e.clave));
    const faltan = Object.keys(ESTADISTICOS).filter(c => !claves.has(c));
    assert.deepEqual(faltan, [], 'Agrega estas definiciones a db/seed/catalogo.json');
  });

  test('cada definición es válida para las tablas de la base', () => {
    const vistas = new Set();
    for (const e of catalogo.estadisticos) {
      assert.ok(!vistas.has(e.clave), `clave repetida: ${e.clave}`);
      vistas.add(e.clave);
      for (const campo of ['clave', 'nombre', 'categoria', 'formula_latex', 'descripcion']) {
        assert.ok(e[campo], `${e.clave}: falta "${campo}" (es NOT NULL en la base)`);
      }
      assert.ok(e.clave.length <= 50, `${e.clave}: clave de más de 50 caracteres`);
      assert.ok(categorias.includes(e.categoria), `${e.clave}: categoría "${e.categoria}" no existe en el ENUM`);
      // Sin las 4 escalas, el backend no sabría si permitir el cálculo
      assert.deepEqual(e.escalas.map(s => s.escala).sort(), [...ESCALAS].sort(), `${e.clave}: debe definir las 4 escalas`);
      for (const s of e.simbolos ?? []) assert.ok(s.simbolo_latex.length <= 60, `${e.clave}: símbolo demasiado largo`);
    }
  });

  test('el glosario no repite términos', () => {
    const terminos = catalogo.glosario.map(g => g.termino);
    assert.equal(new Set(terminos).size, terminos.length);
  });
});
