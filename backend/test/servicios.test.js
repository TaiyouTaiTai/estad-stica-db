import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarEstadisticos } from '../src/services/calculo.service.js';
import { evaluarPermiso, estadisticosPermitidos } from '../src/services/permisos.js';
import { GRAFICAS, graficasPermitidas } from '../src/graficas/index.js';
import { ErrorCalculo } from '../src/calculos/helpers.js';

// Catálogo falso con la misma forma que el que arma catalogo.service.js
function catalogoFalso() {
  const todas = { nominal: true, ordinal: true, intervalo: true, razon: true };
  const def = (id, clave, escalas) => ({
    id, clave, nombre: clave, calculable: true,
    escalas: Object.fromEntries(Object.entries(escalas).map(([e, p]) => [e, { permitido: p, motivo: `motivo ${e}` }]))
  });
  const defs = [
    def(1, 'media', { nominal: false, ordinal: false, intervalo: true, razon: true }),
    def(2, 'moda', todas),
    def(3, 'cuartil', { ...todas, nominal: false }),
    def(4, 'rango', { nominal: false, ordinal: false, intervalo: true, razon: true })
  ];
  return { definiciones: defs, porClave: new Map(defs.map(d => [d.clave, d])) };
}

const colNum = { id: 10, nombre: 'edad', tipo_dato: 'numerico', escala: 'razon' };
const colTxt = { id: 11, nombre: 'ciudad', tipo_dato: 'texto', escala: 'nominal' };
const muestra = (valores) => ({
  columna: 'edad', valores, filas: valores.map((_, i) => i),
  excluidos: [{ fila: 99, valor: 'N/A', motivo: 'celda vacía' }], decimales: 2, naturaleza: 'discreta'
});

describe('permisos según escala y tipo', () => {
  const cat = catalogoFalso();

  test('la media no se permite en una columna nominal, con el motivo del catálogo', () => {
    const p = evaluarPermiso(cat, 'media', colTxt);
    assert.equal(p.permitido, false);
  });

  test('la moda sí se permite en texto', () => {
    assert.equal(evaluarPermiso(cat, 'moda', colTxt).permitido, true);
  });

  test('estadístico que no está en el catálogo', () => {
    assert.match(evaluarPermiso(cat, 'varianza', colNum).motivo, /catálogo/);
  });

  test('lista de permitidos por columna', () => {
    assert.deepEqual(estadisticosPermitidos(cat, colTxt), ['moda']);
    assert.deepEqual(estadisticosPermitidos(cat, colNum), ['media', 'moda', 'cuartil', 'rango']);
    assert.ok(!graficasPermitidas(colTxt).includes('histograma'));
    assert.ok(graficasPermitidas(colTxt).includes('barras'));
  });
});

describe('ejecutarEstadisticos', () => {
  const cat = catalogoFalso();

  test('calcula, arma datos_usados según el contrato y separa errores', () => {
    const r = ejecutarEstadisticos({
      catalogo: cat, columna: colNum, muestra: muestra([1, 2, 3, 4]),
      pedidos: [{ clave: 'media' }, { clave: 'cuartil', parametro: 7 }, { clave: 'varianza' }]
    });
    assert.equal(r.resultados.length, 1);
    const media = r.resultados[0];
    assert.equal(media.valor_num, 2.5);
    assert.equal(media.definicion_id, 1);
    assert.equal(media.columna_id, 10);
    assert.equal(media.n_usado, 4);
    assert.deepEqual(Object.keys(media.datos_usados), ['columna', 'filas', 'valores', 'excluidos']);
    assert.equal(r.errores.length, 2);
    assert.match(r.errores[0].error, /entre 1 y 3/);
  });

  test('no repite un estadístico pedido dos veces', () => {
    const r = ejecutarEstadisticos({
      catalogo: cat, columna: colNum, muestra: muestra([1, 2, 3]),
      pedidos: [{ clave: 'media' }, { clave: 'media' }, { clave: 'cuartil' }, { clave: 'cuartil', parametro: 1 }]
    });
    assert.equal(r.resultados.length, 2);
  });

  test('agrupado: usa la versión agrupada si existe y avisa si no', () => {
    const r = ejecutarEstadisticos({
      catalogo: cat, columna: colNum, muestra: muestra([1, 2, 3, 4, 5, 6, 7, 8]),
      pedidos: [{ clave: 'media' }, { clave: 'rango' }], opciones: { agrupado: true }
    });
    assert.ok(r.resultados[0].valor_json.distribucion);
    assert.equal(r.avisos.length, 1);
  });
});

describe('gráficas', () => {
  const m = muestra([1, 2, 2, 3, 3, 3, 4, 10]);

  test('polígono cerrado en cero y ojiva empezando en cero', () => {
    const pol = GRAFICAS.poligono.generar(m, {});
    assert.equal(pol.datos[0].y, 0);
    assert.equal(pol.datos.at(-1).y, 0);
    const oji = GRAFICAS.ojiva.generar(m, {});
    assert.equal(oji.datos[0].y, 0);
    assert.equal(oji.datos.at(-1).y, 8);
  });

  test('caja ya no falla (antes: Cannot read properties of undefined)', () => {
    const c = GRAFICAS.caja.generar(m, {});
    assert.deepEqual(c.datos.atipicos, [10]);
  });

  test('pastel con demasiadas categorías da un error didáctico', () => {
    const muchas = muestra(Array.from({ length: 30 }, (_, i) => i));
    assert.throws(() => GRAFICAS.pastel.generar(muchas, {}), ErrorCalculo);
  });

  test('barras con texto cuenta y ordena', () => {
    const b = GRAFICAS.barras.generar({ ...m, valores: ['b', 'a', 'b'], naturaleza: 'na' }, {});
    assert.deepEqual(b.datos.map(d => [d.categoria, d.frecuencia]), [['a', 1], ['b', 2]]);
  });
});
