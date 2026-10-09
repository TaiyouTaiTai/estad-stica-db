import pool, { enTransaccion } from '../config/db.js';
import { env } from '../config/env.js';
import { noEncontrado } from '../lib/errores.js';
import { normalizarTabla, analizarColumnas, aNumero, esVacio } from './lectura.js';

const COLUMNAS_META = 'id, posicion, nombre, tipo_dato, escala, naturaleza, unidad, decimales, n_validos, n_nulos';

function prepararTabla({ columnas, filas }) {
  const tabla = normalizarTabla({ columnas, filas }, { maxFilas: env.MAX_FILAS, maxColumnas: env.MAX_COLUMNAS });
  const { meta, avisos } = analizarColumnas(tabla);
  return { tabla, meta, avisos: [...tabla.avisos, ...avisos] };
}

// Todas las columnas en un solo INSERT (antes era una consulta por celda)
async function insertarColumnas(conn, datasetId, meta) {
  const filas = meta.map(c => [
    datasetId, c.posicion, c.nombre, c.tipo_dato, c.escala, c.naturaleza,
    c.unidad ?? null, c.decimales ?? 2, c.n_validos, c.n_nulos
  ]);
  await conn.query(
    'INSERT INTO dataset_columna (dataset_id, posicion, nombre, tipo_dato, escala, naturaleza, unidad, decimales, n_validos, n_nulos) VALUES ?',
    [filas]
  );
}

export async function crearDataset(usuarioId, { titulo, origen, columnas, filas }) {
  const { tabla, meta, avisos } = prepararTabla({ columnas, filas });
  return enTransaccion(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO dataset (usuario_id, titulo, origen, n_filas, n_columnas, datos_json, avisos_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId, titulo.slice(0, 200), origen, tabla.filas.length, tabla.columnas.length,
        JSON.stringify({ columnas: tabla.columnas, filas: tabla.filas }),
        avisos.length ? JSON.stringify(avisos) : null
      ]
    );
    await insertarColumnas(conn, r.insertId, meta);
    return { id: r.insertId, n_filas: tabla.filas.length, n_columnas: tabla.columnas.length, avisos };
  });
}

// Reemplaza los datos de un dataset (ej. el usuario editó su tabla en la app).
// Los análisis anteriores se borran porque ya no corresponden a los datos nuevos.
// Si una columna conserva su nombre y tipo, se conservan los ajustes que el
// usuario hizo a mano (escala, unidad, decimales).
export async function reemplazarDatos(usuarioId, datasetId, { titulo, columnas, filas }) {
  const actual = await obtenerDataset(usuarioId, datasetId, { conDatos: false });
  const { tabla, meta, avisos } = prepararTabla({ columnas, filas });

  const previas = new Map(actual.columnas.map(c => [c.nombre, c]));
  for (const c of meta) {
    const p = previas.get(c.nombre);
    if (p && p.tipo_dato === c.tipo_dato) Object.assign(c, { escala: p.escala, unidad: p.unidad, decimales: p.decimales });
  }

  await enTransaccion(async (conn) => {
    await conn.execute('DELETE FROM analisis WHERE dataset_id = ?', [datasetId]);
    await conn.execute('DELETE FROM dataset_columna WHERE dataset_id = ?', [datasetId]);
    await conn.execute(
      `UPDATE dataset SET titulo = ?, n_filas = ?, n_columnas = ?, datos_json = ?, avisos_json = ? WHERE id = ?`,
      [
        (titulo ?? actual.titulo).slice(0, 200), tabla.filas.length, tabla.columnas.length,
        JSON.stringify({ columnas: tabla.columnas, filas: tabla.filas }),
        avisos.length ? JSON.stringify(avisos) : null, datasetId
      ]
    );
    await insertarColumnas(conn, datasetId, meta);
  });
  return { id: datasetId, n_filas: tabla.filas.length, n_columnas: tabla.columnas.length, avisos };
}

export async function listarDatasets(usuarioId) {
  // Sin datos_json: puede pesar varios MB y para el listado no hace falta
  const [rows] = await pool.execute(
    `SELECT id, titulo, origen, n_filas, n_columnas, creado_en, actualizado_en
     FROM dataset WHERE usuario_id = ? ORDER BY creado_en DESC`,
    [usuarioId]
  );
  return rows;
}

// Trae un dataset verificando que sea del usuario. Lanza 404 si no.
export async function obtenerDataset(usuarioId, datasetId, { conDatos = true } = {}) {
  const [rows] = await pool.execute(
    `SELECT id, titulo, origen, n_filas, n_columnas, avisos_json AS avisos, creado_en, actualizado_en
            ${conDatos ? ', datos_json AS datos' : ''}
     FROM dataset WHERE id = ? AND usuario_id = ?`,
    [datasetId, usuarioId]
  );
  if (rows.length === 0) throw noEncontrado('Dataset');
  const [columnas] = await pool.execute(
    `SELECT ${COLUMNAS_META} FROM dataset_columna WHERE dataset_id = ? ORDER BY posicion`,
    [datasetId]
  );
  return { ...rows[0], avisos: rows[0].avisos ?? [], columnas };
}

export function buscarColumna(dataset, columnaId) {
  const col = dataset.columnas.find(c => c.id === columnaId);
  if (!col) throw noEncontrado('Columna');
  return col;
}

export async function eliminarDataset(usuarioId, datasetId) {
  const [r] = await pool.execute('DELETE FROM dataset WHERE id = ? AND usuario_id = ?', [datasetId, usuarioId]);
  if (r.affectedRows === 0) throw noEncontrado('Dataset');
}

// Permite corregir lo que se detectó automáticamente (escala, decimales…)
export async function actualizarColumna(usuarioId, datasetId, columnaId, cambios) {
  const dataset = await obtenerDataset(usuarioId, datasetId, { conDatos: false });
  const col = buscarColumna(dataset, columnaId);

  await enTransaccion(async (conn) => {
    const campos = Object.keys(cambios);
    if (campos.length) {
      await conn.execute(
        `UPDATE dataset_columna SET ${campos.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...campos.map(c => cambios[c]), columnaId]
      );
    }
    // El nombre también vive en datos_json.columnas: se mantienen sincronizados
    if (cambios.nombre) {
      await conn.execute(
        `UPDATE dataset SET datos_json = JSON_SET(datos_json, CONCAT('$.columnas[', ?, ']'), ?) WHERE id = ?`,
        [col.posicion, cambios.nombre, datasetId]
      );
    }
  });
  return { ...col, ...cambios };
}

// Saca los valores de una columna para calcular, separando los que no sirven.
// Devuelve la "muestra" que reciben las funciones de src/calculos.
export function extraerMuestra(dataset, columna) {
  const numerica = columna.tipo_dato === 'numerico';
  const valores = [], filas = [], excluidos = [];
  dataset.datos.filas.forEach((fila, idx) => {
    const v = fila[columna.posicion];
    if (esVacio(v)) {
      excluidos.push({ fila: idx, valor: v ?? null, motivo: 'celda vacía' });
      return;
    }
    if (numerica) {
      const n = aNumero(v);
      if (n === null) {
        excluidos.push({ fila: idx, valor: v, motivo: 'no es un número' });
        return;
      }
      valores.push(n);
    } else {
      valores.push(typeof v === 'string' ? v : String(v));
    }
    filas.push(idx);
  });
  return {
    columna: columna.nombre,
    valores,
    filas,
    excluidos,
    decimales: columna.decimales ?? 2,
    naturaleza: columna.naturaleza
  };
}

// Pares (x, y) para la gráfica de dispersión: solo filas donde ambas columnas son números.
export function extraerPares(dataset, colX, colY) {
  const puntos = [];
  dataset.datos.filas.forEach((fila, idx) => {
    const x = aNumero(fila[colX.posicion]);
    const y = aNumero(fila[colY.posicion]);
    if (x !== null && y !== null) puntos.push({ fila: idx, x, y });
  });
  return puntos;
}
