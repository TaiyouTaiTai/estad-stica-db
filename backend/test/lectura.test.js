import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  aNumero, celdaSimple, esVacio, normalizarTabla, detectarColumna, analizarColumnas, leerExcel, leerCsv
} from '../src/services/lectura.js';

const LIMITES = { maxFilas: 1000, maxColumnas: 50 };

describe('conversión de celdas', () => {
  test('aNumero entiende formatos comunes', () => {
    assert.equal(aNumero(3), 3);
    assert.equal(aNumero(' 3.5 '), 3.5);
    assert.equal(aNumero('3,5'), 3.5); // coma decimal
    assert.equal(aNumero('1,234,567.5'), 1234567.5); // separador de miles
    assert.equal(aNumero('-2e3'), -2000);
    assert.equal(aNumero('abc'), null);
    assert.equal(aNumero('12abc'), null);
    assert.equal(aNumero(''), null);
    assert.equal(aNumero(true), null);
  });

  test('celdaSimple desenvuelve los objetos de ExcelJS', () => {
    assert.equal(celdaSimple({ formula: 'A1+A2', result: 7 }), 7);
    assert.equal(celdaSimple({ richText: [{ text: 'Ho' }, { text: 'la' }] }), 'Hola');
    assert.equal(celdaSimple({ text: 'sitio', hyperlink: 'http://x' }), 'sitio');
    assert.equal(celdaSimple({ error: '#DIV/0!' }), null);
    assert.equal(celdaSimple(new Date('2024-03-05T00:00:00Z')), '2024-03-05');
    assert.equal(celdaSimple('  '), null);
  });

  test('marcas de "sin dato"', () => {
    for (const v of [null, undefined, 'N/A', 'na', '-', 'sin dato']) assert.ok(esVacio(v), String(v));
    assert.ok(!esVacio(0));
  });
});

describe('normalizarTabla', () => {
  test('arregla encabezados vacíos y repetidos, rellena filas cortas y quita filas vacías', () => {
    const r = normalizarTabla({
      columnas: ['edad', null, 'edad'],
      filas: [[1, 'a'], [null, null, null], [2, 'b', 3]]
    }, LIMITES);
    assert.deepEqual(r.columnas, ['edad', 'Columna 2', 'edad (2)']);
    assert.deepEqual(r.filas, [[1, 'a', null], [2, 'b', 3]]);
    assert.equal(r.avisos.length, 3);
  });

  test('respeta los límites', () => {
    assert.throws(() => normalizarTabla({ columnas: ['a'], filas: [[1], [2]] }, { maxFilas: 1, maxColumnas: 5 }));
    assert.throws(() => normalizarTabla({ columnas: ['a'], filas: [[null]] }, LIMITES), /no tiene filas/);
  });
});

describe('detección de columnas', () => {
  test('numérica con algunos "N/A" y un texto suelto', () => {
    const valores = [...Array.from({ length: 20 }, (_, i) => i + 1), 'N/A', 'error'];
    const c = detectarColumna('edad', valores);
    assert.equal(c.tipo_dato, 'numerico');
    assert.equal(c.escala, 'razon');
    assert.equal(c.naturaleza, 'discreta');
    assert.equal(c.n_nulos, 1);
    assert.equal(c.avisos.length, 1); // 'error' no es un número
  });

  test('texto, fecha, booleano e intervalo', () => {
    assert.equal(detectarColumna('c', ['Lima', 'Quito']).tipo_dato, 'texto');
    assert.equal(detectarColumna('c', ['Lima', 'Quito']).escala, 'nominal');
    assert.equal(detectarColumna('c', ['2024-01-01', '2024-02-01']).tipo_dato, 'fecha');
    assert.equal(detectarColumna('c', [true, false]).tipo_dato, 'booleano');
    assert.equal(detectarColumna('c', [-3, 2.5]).escala, 'intervalo');
    assert.equal(detectarColumna('c', [1.5, 2]).naturaleza, 'continua');
  });

  test('los códigos con ceros a la izquierda no se pierden en datos_json', () => {
    // La tabla guarda el texto original; solo el cálculo lo convierte a número
    const r = normalizarTabla({ columnas: ['codigo'], filas: [['007'], ['010']] }, LIMITES);
    assert.deepEqual(r.filas, [['007'], ['010']]);
  });

  test('analizarColumnas usa la posición 0-based de datos_json', () => {
    const { meta } = analizarColumnas({ columnas: ['a', 'b'], filas: [[1, 'x']] });
    assert.deepEqual(meta.map(m => m.posicion), [0, 1]);
  });
});

describe('lectura de archivos', () => {
  test('Excel con fórmulas, fechas y filas vacías', async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Notas');
    hoja.addRow(['alumno', 'nota', 'doble']);
    hoja.addRow(['Ana', 15, { formula: 'B2*2', result: 30 }]);
    hoja.addRow([]);
    hoja.addRow(['Luis', 12, { formula: 'B4*2', result: 24 }]);
    const buffer = await libro.xlsx.writeBuffer();

    const t = await leerExcel(Buffer.from(buffer));
    assert.equal(t.titulo, 'Notas');
    assert.deepEqual(t.columnas, ['alumno', 'nota', 'doble']);
    assert.deepEqual(t.filas, [['Ana', 15, 30], ['Luis', 12, 24]]);
  });

  test('un archivo que no es Excel da un error claro', async () => {
    await assert.rejects(leerExcel(Buffer.from('hola')), /\.xlsx válido/);
  });

  test('CSV con punto y coma y coma decimal (formato de Excel en español)', async () => {
    const t = await leerCsv(Buffer.from('nombre;peso\nAna;55,5\nLuis;70\n'));
    assert.deepEqual(t.columnas, ['nombre', 'peso']);
    const c = detectarColumna('peso', t.filas.map(f => f[1]));
    assert.equal(c.tipo_dato, 'numerico');
    assert.equal(aNumero(t.filas[0][1]), 55.5);
  });
});
