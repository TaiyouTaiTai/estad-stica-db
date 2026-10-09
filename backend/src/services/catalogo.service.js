import pool from '../config/db.js';
import { ESTADISTICOS } from '../calculos/index.js';

// El catálogo didáctico casi nunca cambia (se carga con `npm run seed`), así que
// se guarda en memoria y se recarga cada minuto en vez de consultarlo en cada petición.
const DURACION_MS = 60 * 1000;
let cache = null;
let expira = 0;

async function cargar() {
  const [defs] = await pool.query(
    `SELECT id, clave, nombre, categoria, formula_latex, formula_texto, descripcion,
            cuando_usar, malinterpretacion, requiere_ordenado, requiere_agrupado
     FROM definicion_estadistico ORDER BY categoria, nombre`
  );
  const [simbolos] = await pool.query(
    'SELECT definicion_id, simbolo_latex, significado, orden FROM simbolo_formula ORDER BY definicion_id, orden'
  );
  const [escalas] = await pool.query(
    'SELECT definicion_id, escala, permitido, motivo FROM estadistico_escala'
  );
  const [glosario] = await pool.query('SELECT id, termino, definicion, ejemplo FROM glosario ORDER BY termino');

  const porId = new Map();
  const porClave = new Map();
  for (const d of defs) {
    const def = {
      ...d,
      requiere_ordenado: !!d.requiere_ordenado,
      requiere_agrupado: !!d.requiere_agrupado,
      calculable: d.clave in ESTADISTICOS,
      simbolos: [],
      escalas: {}
    };
    porId.set(d.id, def);
    porClave.set(d.clave, def);
  }
  for (const s of simbolos) {
    const { definicion_id, ...resto } = s;
    porId.get(definicion_id)?.simbolos.push(resto);
  }
  for (const e of escalas) {
    const def = porId.get(e.definicion_id);
    if (def) def.escalas[e.escala] = { permitido: !!e.permitido, motivo: e.motivo };
  }
  return { definiciones: [...porClave.values()], porClave, glosario };
}

export async function obtenerCatalogo() {
  if (!cache || Date.now() > expira) {
    cache = await cargar();
    expira = Date.now() + DURACION_MS;
  }
  return cache;
}
