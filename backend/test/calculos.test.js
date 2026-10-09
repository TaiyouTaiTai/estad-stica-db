import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { media, mediana, moda } from '../src/calculos/tendenciaCentral.js';
import { rango, varianza, desviacionEstandar, coeficienteVariacion } from '../src/calculos/variabilidad.js';
import { cuartil, decil, percentil, resumenCaja } from '../src/calculos/posicion.js';
import { generarDistribucion, mediaAgrupada, medianaAgrupada, modaAgrupada } from '../src/calculos/agrupados.js';
import { ErrorCalculo, redondear } from '../src/calculos/helpers.js';

const muestra = (valores, extra = {}) => ({
  columna: 'x', valores, filas: valores.map((_, i) => i), excluidos: [], decimales: 2, naturaleza: 'discreta', ...extra
});

// Conjunto clásico de libro: media 5, varianza poblacional 4, desviación poblacional 2
const D = [2, 4, 4, 4, 5, 5, 7, 9];

describe('tendencia central', () => {
  test('media', () => {
    const r = media(muestra(D));
    assert.equal(r.valor_num, 5);
    assert.deepEqual(r.sustitucion.variables, { '\\sum x_i': 40, n: 8 });
    assert.equal(r.pasos.length, 3);
    assert.deepEqual(r.pasos.map(p => p.orden), [1, 2, 3]);
  });

  test('media con el ejemplo del contrato del hover (plan-db-mvp.md)', () => {
    const r = media(muestra([23, 31, 28]));
    assert.equal(r.sustitucion.resultado, 27.33);
    assert.deepEqual(r.pasos[0], { orden: 1, texto: 'Suma todos los valores', expresion: '23 + 31 + 28', resultado: 82 });
  });

  test('mediana par e impar', () => {
    assert.equal(mediana(muestra(D)).valor_num, 4.5);
    assert.equal(mediana(muestra([9, 1, 5])).valor_num, 5);
  });

  test('moda unimodal, bimodal y amodal', () => {
    assert.equal(moda(muestra(D)).valor_num, 4);
    const bi = moda(muestra([1, 1, 2, 2, 3]));
    assert.equal(bi.valor_json.clasificacion, 'bimodal');
    assert.deepEqual(bi.valor_json.modas, [1, 2]);
    assert.equal(moda(muestra([1, 2, 3])).valor_json.clasificacion, 'amodal');
    assert.equal(moda(muestra([1, 1, 2, 2])).valor_json.clasificacion, 'amodal');
  });

  test('moda con texto', () => {
    const r = moda(muestra(['Lima', 'Quito', 'Lima']));
    assert.equal(r.valor_txt, 'Lima');
    assert.equal(r.valor_num, null);
  });

  test('sin datos lanza un error entendible', () => {
    assert.throws(() => media(muestra([])), ErrorCalculo);
  });
});

describe('variabilidad', () => {
  test('rango', () => assert.equal(rango(muestra(D)).valor_num, 7));

  test('varianza muestral (n-1) por defecto y poblacional (n) opcional', () => {
    assert.equal(redondear(varianza(muestra(D)).valor_num, 6), redondear(32 / 7, 6));
    assert.equal(varianza(muestra(D), { poblacional: true }).valor_num, 4);
    assert.equal(varianza(muestra(D)).sustitucion.tipo, 'muestral');
  });

  test('desviación estándar', () => {
    assert.equal(desviacionEstandar(muestra(D), { poblacional: true }).valor_num, 2);
    assert.equal(redondear(desviacionEstandar(muestra(D)).valor_num, 4), 2.1381);
  });

  test('varianza muestral necesita al menos 2 datos', () => {
    assert.throws(() => varianza(muestra([5])), ErrorCalculo);
    assert.equal(varianza(muestra([5]), { poblacional: true }).valor_num, 0);
  });

  test('coeficiente de variación rechaza media cero o negativa', () => {
    assert.throws(() => coeficienteVariacion(muestra([-1, 1])), ErrorCalculo);
    assert.equal(redondear(coeficienteVariacion(muestra(D), { poblacional: true }).valor_num, 2), 40);
  });

  test('con muchos datos los pasos no crecen sin control', () => {
    const muchos = Array.from({ length: 10000 }, (_, i) => i);
    const r = varianza(muestra(muchos));
    assert.ok(JSON.stringify(r.pasos).length < 2000);
  });
});

describe('posición', () => {
  test('cuartiles por el método k(n+1)/4 con interpolación', () => {
    assert.equal(cuartil(muestra(D), { parametro: 1 }).valor_num, 4);
    assert.equal(cuartil(muestra(D), { parametro: 3 }).valor_num, 6.5);
  });

  test('posiciones fuera del rango usan el extremo (antes devolvía null)', () => {
    assert.equal(cuartil(muestra([3, 8]), { parametro: 1 }).valor_num, 3);
    assert.equal(percentil(muestra(D), { parametro: 99 }).valor_num, 9);
  });

  test('posición exacta sin error de punto flotante', () => {
    // 3 × (9 + 1) / 10 = 3 exacto → el tercer dato, sin interpolar
    const r = decil(muestra([10, 20, 30, 40, 50, 60, 70, 80, 90]), { parametro: 3 });
    assert.equal(r.valor_num, 30);
    assert.match(r.pasos[2].texto, /exacta/);
  });

  test('diagrama de caja con atípico', () => {
    const r = resumenCaja(muestra([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]));
    const c = r.valor_json;
    assert.equal(c.q1, 2.75);
    assert.equal(c.q3, 8.25);
    assert.equal(c.riq, 5.5);
    assert.deepEqual(c.atipicos, [100]);
    assert.equal(c.bigote_sup, 9); // el último dato real dentro de la cerca, no la cerca
    assert.equal(c.bigote_inf, 1);
  });
});

describe('datos agrupados', () => {
  test('todas las observaciones caen en alguna clase y el máximo se incluye', () => {
    const datos = Array.from({ length: 50 }, (_, i) => (i * 7) % 23);
    for (const metodo of ['sturges', 'raiz', 'scott']) {
      const d = generarDistribucion(datos, { metodo, discreta: true });
      assert.equal(d.clases.reduce((s, c) => s + c.fi, 0), 50, metodo);
      assert.equal(d.clases.at(-1).Fi, 50);
      assert.ok(d.clases.at(-1).lim_sup >= d.max);
    }
  });

  test('scott ya no falla (antes: desviacionEstandar is not defined)', () => {
    assert.doesNotThrow(() => generarDistribucion(D, { metodo: 'scott' }));
  });

  test('datos decimales en el borde de una clase no se van a la clase anterior', () => {
    const datos = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const d = generarDistribucion(datos, { metodo: 'raiz', decimales: 1 });
    // fi de cada clase = cuántos datos cumplen lim_inf <= x < lim_sup (la última, cerrada)
    d.clases.forEach((c, i) => {
      const ultima = i === d.clases.length - 1;
      const esperado = datos.filter(x => x >= c.lim_inf && (ultima ? x <= c.lim_sup : x < c.lim_sup)).length;
      assert.equal(c.fi, esperado, `clase [${c.lim_inf}, ${c.lim_sup})`);
    });
  });

  test('todos los datos iguales: una sola clase', () => {
    const d = generarDistribucion([5, 5, 5], { discreta: true });
    assert.equal(d.k, 1);
    assert.equal(d.clases[0].fi, 3);
  });

  test('media, mediana y moda agrupadas devuelven números razonables', () => {
    const datos = [12, 15, 17, 18, 20, 21, 22, 22, 23, 25, 26, 28, 30, 31, 35];
    const m = muestra(datos);
    const med = mediaAgrupada(m).valor_num;
    assert.ok(Math.abs(med - 23) < 2, `media agrupada ${med}`);
    const me = medianaAgrupada(m).valor_num;
    assert.ok(me >= 12 && me <= 35);
    const mo = modaAgrupada(m).valor_num;
    assert.ok(mo >= 12 && mo <= 35);
    assert.ok(mediaAgrupada(m).valor_json.distribucion.clases.length > 0);
  });
});
