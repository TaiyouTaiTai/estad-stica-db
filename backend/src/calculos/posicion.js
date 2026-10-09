import { redondear as r, limpio, ordenar, listar, numerar, requerirDatos } from './helpers.js';

// Valor en la posición k(n+1)/partes de los datos ordenados (método de la mayoría de
// libros de texto en español). Si la posición cae entre dos datos se interpola;
// si cae antes del primero o después del último, se usa el extremo.
// Se recibe k y partes por separado (k(n+1)/partes) para que la posición sea exacta:
// 0.3 * 10 da 3.0000000000000004 en punto flotante, pero 3 * 10 / 10 da 3.
export function cuantil(ordenados, k, partes) {
  const n = ordenados.length;
  const posicion = (k * (n + 1)) / partes;
  if (posicion < 1) return { posicion, valor: ordenados[0], ajuste: 'inicio' };
  if (posicion > n) return { posicion, valor: ordenados[n - 1], ajuste: 'fin' };
  const inf = Math.floor(posicion);
  const fraccion = posicion - inf;
  const a = ordenados[inf - 1];
  if (fraccion === 0) return { posicion, valor: a, ajuste: null };
  const b = ordenados[inf];
  return { posicion, valor: a + fraccion * (b - a), inf, fraccion, a, b, ajuste: 'interpolado' };
}

function pasoUbicacion(q, d) {
  if (q.ajuste === 'inicio') {
    return { texto: 'La posición queda antes del primer dato, así que se toma el primero', resultado: r(q.valor, d) };
  }
  if (q.ajuste === 'fin') {
    return { texto: 'La posición queda después del último dato, así que se toma el último', resultado: r(q.valor, d) };
  }
  if (q.ajuste === null) {
    return { texto: `La posición es exacta: toma el dato número ${q.posicion}`, resultado: r(q.valor, d) };
  }
  return {
    texto: `La posición cae entre el dato ${q.inf} (${q.a}) y el dato ${q.inf + 1} (${q.b}): avanza ${r(q.fraccion, 4)} de la distancia entre ellos`,
    expresion: `${q.a} + ${r(q.fraccion, 4)} × (${q.b} - ${q.a})`,
    resultado: r(q.valor, d)
  };
}

// Cuartiles (4 partes), deciles (10) y percentiles (100) son la misma idea.
function medidaPosicion({ valores, decimales: d }, k, partes, simbolo, nombre) {
  requerirDatos(valores, 2, `el ${nombre}`);
  const x = ordenar(valores);
  const n = x.length;
  const q = cuantil(x, k, partes);
  return {
    valor_num: limpio(q.valor),
    sustitucion: {
      formula_latex: `${simbolo}_{${k}} = x_{\\frac{${k}(n+1)}{${partes}}}`,
      variables: { k, n, posicion: r(q.posicion, 4) },
      resultado: r(q.valor, d)
    },
    pasos: numerar([
      { texto: 'Ordena los datos de menor a mayor', expresion: listar(x) },
      { texto: `Calcula en qué posición está el ${nombre} ${k}`, expresion: `${k} × (${n} + 1) / ${partes}`, resultado: r(q.posicion, 4) },
      pasoUbicacion(q, d)
    ])
  };
}

export const cuartil = (m, { parametro }) => medidaPosicion(m, parametro, 4, 'Q', 'cuartil');
export const decil = (m, { parametro }) => medidaPosicion(m, parametro, 10, 'D', 'decil');
export const percentil = (m, { parametro }) => medidaPosicion(m, parametro, 100, 'P', 'percentil');

// ---- RESUMEN DE CINCO NÚMEROS / DIAGRAMA DE CAJA ----
export function calcularCaja(valores) {
  const x = ordenar(valores);
  const n = x.length;
  const q1 = cuantil(x, 1, 4).valor;
  const med = cuantil(x, 2, 4).valor;
  const q3 = cuantil(x, 3, 4).valor;
  const riq = q3 - q1;
  const cercaInf = q1 - 1.5 * riq;
  const cercaSup = q3 + 1.5 * riq;
  // Los bigotes llegan hasta el dato real más extremo que sigue dentro de las cercas
  const dentro = x.filter(v => v >= cercaInf && v <= cercaSup);
  return {
    min: x[0],
    q1: limpio(q1),
    mediana: limpio(med),
    q3: limpio(q3),
    max: x[n - 1],
    riq: limpio(riq),
    cerca_inf: limpio(cercaInf),
    cerca_sup: limpio(cercaSup),
    bigote_inf: dentro[0],
    bigote_sup: dentro[dentro.length - 1],
    atipicos: x.filter(v => v < cercaInf || v > cercaSup)
  };
}

export function resumenCaja({ valores, decimales: d }) {
  requerirDatos(valores, 4, 'el diagrama de caja');
  const c = calcularCaja(valores);
  return {
    valor_json: c,
    sustitucion: {
      formula_latex: 'RIQ = Q_3 - Q_1, \\quad \\text{atípico si } x < Q_1 - 1.5 \\cdot RIQ \\text{ o } x > Q_3 + 1.5 \\cdot RIQ',
      variables: { Q_1: r(c.q1, d), Q_3: r(c.q3, d), RIQ: r(c.riq, d) },
      resultado: c
    },
    pasos: numerar([
      { texto: 'Ordena los datos y ubica el mínimo y el máximo', expresion: `mín = ${c.min}, máx = ${c.max}` },
      { texto: 'Calcula los cuartiles Q1, mediana (Q2) y Q3', expresion: `Q1 = ${r(c.q1, d)}, Q2 = ${r(c.mediana, d)}, Q3 = ${r(c.q3, d)}` },
      { texto: 'Calcula el rango intercuartílico (la "caja")', expresion: `${r(c.q3, d)} - ${r(c.q1, d)}`, resultado: r(c.riq, d) },
      {
        texto: 'Calcula las cercas: todo dato fuera de ellas es atípico',
        expresion: `${r(c.q1, d)} - 1.5 × ${r(c.riq, d)} = ${r(c.cerca_inf, d)}  y  ${r(c.q3, d)} + 1.5 × ${r(c.riq, d)} = ${r(c.cerca_sup, d)}`
      },
      {
        texto: c.atipicos.length
          ? `Hay ${c.atipicos.length} valor(es) atípico(s); los bigotes llegan hasta el último dato dentro de las cercas`
          : 'No hay valores atípicos; los bigotes llegan hasta el mínimo y el máximo',
        expresion: c.atipicos.length ? listar(c.atipicos) : undefined,
        resultado: `bigotes: ${c.bigote_inf} a ${c.bigote_sup}`
      }
    ])
  };
}
