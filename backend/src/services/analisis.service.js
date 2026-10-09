import pool from '../config/db.js';
import { noEncontrado } from '../lib/errores.js';

// Usa un análisis existente (si se pasa analisis_id) o crea uno nuevo.
export async function prepararAnalisis(conn, { usuarioId, datasetId, analisisId, nombre }) {
  if (analisisId) {
    const [rows] = await conn.execute(
      'SELECT id FROM analisis WHERE id = ? AND usuario_id = ? AND dataset_id = ?',
      [analisisId, usuarioId, datasetId]
    );
    if (rows.length === 0) throw noEncontrado('Análisis');
    return analisisId;
  }
  const [r] = await conn.execute(
    'INSERT INTO analisis (dataset_id, usuario_id, nombre) VALUES (?, ?, ?)',
    [datasetId, usuarioId, nombre ?? null]
  );
  return r.insertId;
}

const json = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

// Todos los resultados de una petición en un solo INSERT.
export async function guardarResultados(conn, analisisId, resultados) {
  if (resultados.length === 0) return;
  const filas = resultados.map(r => [
    analisisId, r.columna_id, r.columna_b_id ?? null, r.definicion_id, r.parametro ?? null,
    r.valor_num ?? null, r.valor_txt ?? null, json(r.valor_json), r.n_usado,
    json(r.sustitucion), json(r.pasos), json(r.datos_usados)
  ]);
  await conn.query(
    `INSERT INTO resultado_estadistico
       (analisis_id, columna_id, columna_b_id, definicion_id, parametro,
        valor_num, valor_txt, valor_json, n_usado, sustitucion, pasos, datos_usados)
     VALUES ?`,
    [filas]
  );
}

export async function guardarGrafica(conn, analisisId, { tipo, columna_id, columna_b_id, config }) {
  const [r] = await conn.execute(
    'INSERT INTO grafica (analisis_id, tipo, columna_id, columna_b_id, config_json) VALUES (?, ?, ?, ?, ?)',
    [analisisId, tipo, columna_id, columna_b_id ?? null, json(config)]
  );
  return r.insertId;
}

export async function listarAnalisis(usuarioId, datasetId) {
  const [rows] = await pool.execute(
    `SELECT a.id, a.nombre, a.creado_en,
            (SELECT COUNT(*) FROM resultado_estadistico r WHERE r.analisis_id = a.id) AS n_resultados,
            (SELECT COUNT(*) FROM grafica g WHERE g.analisis_id = a.id) AS n_graficas
     FROM analisis a
     WHERE a.usuario_id = ? AND a.dataset_id = ?
     ORDER BY a.creado_en DESC`,
    [usuarioId, datasetId]
  );
  return rows;
}

// Un análisis completo: cada resultado trae lo que necesita el hover.
export async function obtenerAnalisis(usuarioId, analisisId) {
  const [rows] = await pool.execute(
    'SELECT id, dataset_id, nombre, filtros_json AS filtros, creado_en FROM analisis WHERE id = ? AND usuario_id = ?',
    [analisisId, usuarioId]
  );
  if (rows.length === 0) throw noEncontrado('Análisis');

  const [resultados] = await pool.execute(
    `SELECT r.id, d.clave, d.nombre, r.columna_id, r.columna_b_id, r.parametro,
            r.valor_num, r.valor_txt, r.valor_json, r.n_usado,
            r.sustitucion, r.pasos, r.datos_usados, r.calculado_en
     FROM resultado_estadistico r
     JOIN definicion_estadistico d ON d.id = r.definicion_id
     WHERE r.analisis_id = ?
     ORDER BY r.id`,
    [analisisId]
  );
  const [graficas] = await pool.execute(
    `SELECT id, tipo, columna_id, columna_b_id, config_json AS config, creada_en
     FROM grafica WHERE analisis_id = ? ORDER BY id`,
    [analisisId]
  );
  return { ...rows[0], resultados, graficas };
}

export async function eliminarAnalisis(usuarioId, analisisId) {
  const [r] = await pool.execute('DELETE FROM analisis WHERE id = ? AND usuario_id = ?', [analisisId, usuarioId]);
  if (r.affectedRows === 0) throw noEncontrado('Análisis');
}
