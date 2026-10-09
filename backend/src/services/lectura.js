import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { solicitudInvalida } from '../lib/errores.js';

// Lectura y limpieza de tablas (Excel, CSV o creadas en la app) hasta dejarlas
// en el formato de `dataset.datos_json`: { columnas: [...], filas: [[...]] }.
// Este módulo no toca la base de datos, así se puede probar fácilmente.

// Textos que la gente usa para decir "no hay dato"
const MARCAS_VACIO = new Set(['', 'na', 'n/a', 'n.a.', 'nan', 'null', 'nulo', '-', '--', 's/d', 'sin dato', 'nd']);

export function esVacio(v) {
  if (v === null || v === undefined) return true;
  return typeof v === 'string' && MARCAS_VACIO.has(v.trim().toLowerCase());
}

const RE_NUMERO = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const RE_COMA_DECIMAL = /^[-+]?\d+,\d+$/; // "3,5" (común en español)
const RE_MILES = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/; // "1,234,567.8"

// Convierte una celda a número si de verdad lo es. Devuelve null si no.
export function aNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s/g, '');
  if (RE_NUMERO.test(s)) return Number(s);
  if (RE_MILES.test(s)) return Number(s.replace(/,/g, ''));
  if (RE_COMA_DECIMAL.test(s)) return Number(s.replace(',', '.'));
  return null;
}

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

// ExcelJS devuelve objetos para fórmulas, texto enriquecido, hipervínculos, etc.
// Aquí los reducimos a un valor simple (número, texto, booleano, fecha ISO o null).
export function celdaSimple(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return celdaSimple(v.result); // fórmula
    if ('richText' in v) return v.richText.map(t => t.text).join('').trim() || null;
    if ('text' in v) return celdaSimple(v.text); // hipervínculo
    if ('error' in v) return null; // #DIV/0!, #N/A…
    return null;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  return String(v);
}

// ---- Excel (.xlsx) ----
export async function leerExcel(buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw solicitudInvalida('No se pudo leer el archivo. ¿Es un Excel .xlsx válido? (el formato antiguo .xls no está soportado)');
  }
  const hoja = libro.worksheets[0];
  if (!hoja) throw solicitudInvalida('El archivo no tiene hojas');
  return { titulo: hoja.name, ...tablaDesdeHoja(hoja) };
}

// ---- CSV ----
export async function leerCsv(buffer) {
  const libro = new ExcelJS.Workbook();
  // Si el archivo usa ";" como separador (Excel en español lo hace), lo detectamos
  const primeraLinea = buffer.toString('utf8', 0, Math.min(buffer.length, 2000)).split(/\r?\n/)[0];
  const delimiter = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length ? ';' : ',';
  try {
    // map: dejamos los valores como texto; aNumero() se encarga después (respeta "3,5")
    const hoja = await libro.csv.read(Readable.from(buffer), { parserOptions: { delimiter }, map: v => v });
    return tablaDesdeHoja(hoja);
  } catch {
    throw solicitudInvalida('No se pudo leer el archivo CSV');
  }
}

function tablaDesdeHoja(hoja) {
  const filas = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    // row.values empieza en el índice 1 (convención de ExcelJS)
    filas.push(row.values.slice(1).map(celdaSimple));
  });
  if (filas.length === 0) throw solicitudInvalida('La hoja está vacía');
  const [columnas, ...resto] = filas;
  return { columnas, filas: resto };
}

// ---- Limpieza común para cualquier origen ----
// Deja encabezados únicos y no vacíos, filas del mismo largo, sin filas vacías,
// y junta avisos para el usuario (se guardan en dataset.avisos_json).
export function normalizarTabla({ columnas, filas }, { maxFilas, maxColumnas }) {
  const avisos = [];
  const anchoDatos = filas.reduce((max, f) => Math.max(max, f.length), 0);
  const ancho = Math.max(columnas.length, anchoDatos);
  if (ancho === 0) throw solicitudInvalida('La tabla no tiene columnas');
  if (ancho > maxColumnas) throw solicitudInvalida(`La tabla tiene ${ancho} columnas; el máximo es ${maxColumnas}`);

  const vistos = new Map();
  const nombres = Array.from({ length: ancho }, (_, i) => {
    let nombre = celdaSimple(columnas[i]);
    nombre = nombre === null ? '' : String(nombre).slice(0, 150);
    if (!nombre) {
      nombre = `Columna ${i + 1}`;
      avisos.push({ tipo: 'encabezado_vacio', mensaje: `La columna ${i + 1} no tenía nombre; se llamó "${nombre}".` });
    }
    const repetido = vistos.get(nombre) || 0;
    vistos.set(nombre, repetido + 1);
    if (repetido) {
      const nuevo = `${nombre} (${repetido + 1})`;
      avisos.push({ tipo: 'encabezado_repetido', mensaje: `Había dos columnas llamadas "${nombre}"; la segunda se renombró a "${nuevo}".` });
      nombre = nuevo;
    }
    return nombre;
  });

  const limpias = [];
  let vacias = 0;
  for (const fila of filas) {
    const f = Array.from({ length: ancho }, (_, i) => celdaSimple(fila[i]));
    if (f.every(esVacio)) { vacias++; continue; }
    limpias.push(f);
  }
  if (vacias) avisos.push({ tipo: 'filas_vacias', mensaje: `Se ignoraron ${vacias} fila(s) completamente vacías.` });
  if (limpias.length === 0) throw solicitudInvalida('La tabla no tiene filas con datos');
  if (limpias.length > maxFilas) throw solicitudInvalida(`La tabla tiene ${limpias.length} filas; el máximo es ${maxFilas}`);

  return { columnas: nombres, filas: limpias, avisos };
}

// ---- Detección del tipo de cada columna ----
const UMBRAL = 0.9; // 90% de los valores no vacíos deben ser de un tipo

export function detectarColumna(nombre, valores) {
  let numericos = 0, fechas = 0, booleanos = 0, nulos = 0, enteros = 0, negativos = 0;
  const noNumericos = [];
  valores.forEach((v, fila) => {
    if (esVacio(v)) { nulos++; return; }
    if (typeof v === 'boolean') { booleanos++; return; }
    const num = aNumero(v);
    if (num !== null) {
      numericos++;
      if (Number.isInteger(num)) enteros++;
      if (num < 0) negativos++;
      return;
    }
    if (typeof v === 'string' && RE_FECHA_ISO.test(v)) { fechas++; return; }
    noNumericos.push(fila);
  });

  const validos = valores.length - nulos;
  let tipo_dato = 'mixto';
  if (validos === 0) tipo_dato = 'texto';
  else if (numericos / validos >= UMBRAL) tipo_dato = 'numerico';
  else if (fechas / validos >= UMBRAL) tipo_dato = 'fecha';
  else if (booleanos / validos >= UMBRAL) tipo_dato = 'booleano';
  else if (noNumericos.length / validos >= UMBRAL) tipo_dato = 'texto';

  // La escala es una suposición razonable; el usuario puede corregirla
  // (ej. una columna 1-5 de satisfacción es ordinal, no de razón).
  let escala = 'nominal';
  if (tipo_dato === 'numerico') escala = negativos > 0 ? 'intervalo' : 'razon';
  else if (tipo_dato === 'fecha') escala = 'intervalo';

  const naturaleza = tipo_dato !== 'numerico' ? 'na' : enteros === numericos ? 'discreta' : 'continua';

  const avisos = [];
  if (tipo_dato === 'numerico' && noNumericos.length + fechas + booleanos > 0) {
    const n = noNumericos.length + fechas + booleanos;
    avisos.push({
      tipo: 'valores_no_numericos',
      columna: nombre,
      mensaje: `La columna "${nombre}" es numérica pero tiene ${n} valor(es) que no son números; se excluirán de los cálculos.`
    });
  }

  return { tipo_dato, escala, naturaleza, n_validos: validos, n_nulos: nulos, avisos };
}

// Analiza todas las columnas de una tabla ya normalizada.
export function analizarColumnas({ columnas, filas }) {
  const avisos = [];
  const meta = columnas.map((nombre, i) => {
    const { avisos: a, ...info } = detectarColumna(nombre, filas.map(f => f[i]));
    avisos.push(...a);
    return { posicion: i, nombre, ...info };
  });
  return { meta, avisos };
}
