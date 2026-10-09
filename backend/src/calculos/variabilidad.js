import { redondear as r, limpio, suma, minMax, numerar, requerirDatos, ErrorCalculo } from './helpers.js';

const MAX_DIFERENCIAS_MOSTRADAS = 8;

// ---- RANGO ----
export function rango({ valores: x, decimales: d }) {
  requerirDatos(x, 1, 'el rango');
  const { min, max } = minMax(x);
  const v = max - min;
  return {
    valor_num: limpio(v),
    sustitucion: {
      formula_latex: 'R = x_{max} - x_{min}',
      variables: { 'x_{max}': max, 'x_{min}': min },
      resultado: r(v, d)
    },
    pasos: numerar([
      { texto: 'Busca el valor más grande', resultado: max },
      { texto: 'Busca el valor más pequeño', resultado: min },
      { texto: 'Resta el más pequeño al más grande', expresion: `${max} - ${min}`, resultado: r(v, d) }
    ])
  };
}

// Cálculo compartido por varianza, desviación estándar y coeficiente de variación.
function calcularVarianza(x, d, poblacional) {
  const n = x.length;
  const divisor = poblacional ? n : n - 1;
  const m = suma(x) / n;
  const difCuad = x.map(v => (v - m) ** 2);
  const sumaCuad = suma(difCuad);
  const varianza = sumaCuad / divisor;

  const ejemplos = x.slice(0, MAX_DIFERENCIAS_MOSTRADAS)
    .map((v, i) => `(${v} - ${r(m, d)})² = ${r(difCuad[i], d)}`)
    .join(', ');
  const resto = n > MAX_DIFERENCIAS_MOSTRADAS ? ` … y ${n - MAX_DIFERENCIAS_MOSTRADAS} más` : '';

  const pasos = [
    { texto: 'Calcula la media', expresion: `${r(suma(x), d)} / ${n}`, resultado: r(m, d) },
    { texto: 'A cada dato réstale la media y eleva el resultado al cuadrado', expresion: ejemplos + resto },
    { texto: 'Suma todos esos cuadrados', resultado: r(sumaCuad, d) },
    {
      texto: poblacional
        ? 'Divide entre n (datos de toda la población)'
        : 'Divide entre n - 1 (es una muestra: se resta 1 para no subestimar la variación real)',
      expresion: `${r(sumaCuad, d)} / ${divisor}`,
      resultado: r(varianza, d)
    }
  ];
  return { n, m, sumaCuad, divisor, varianza, pasos };
}

function validarVarianza(x, poblacional, para) {
  requerirDatos(x, poblacional ? 1 : 2, para);
}

// ---- VARIANZA ---- (muestral por defecto; `poblacional: true` divide entre n)
export function varianza({ valores: x, decimales: d }, { poblacional = false } = {}) {
  validarVarianza(x, poblacional, 'la varianza');
  const c = calcularVarianza(x, d, poblacional);
  const simbolo = poblacional ? '\\sigma^2' : 's^2';
  return {
    valor_num: limpio(c.varianza),
    sustitucion: {
      formula_latex: `${simbolo} = \\frac{\\sum (x_i - \\bar{x})^2}{${poblacional ? 'n' : 'n-1'}}`,
      tipo: poblacional ? 'poblacional' : 'muestral',
      variables: { '\\bar{x}': r(c.m, d), '\\sum (x_i - \\bar{x})^2': r(c.sumaCuad, d), [poblacional ? 'n' : 'n-1']: c.divisor },
      resultado: r(c.varianza, d)
    },
    pasos: numerar(c.pasos)
  };
}

// ---- DESVIACIÓN ESTÁNDAR ----
export function desviacionEstandar({ valores: x, decimales: d }, { poblacional = false } = {}) {
  validarVarianza(x, poblacional, 'la desviación estándar');
  const c = calcularVarianza(x, d, poblacional);
  const v = Math.sqrt(c.varianza);
  const simbolo = poblacional ? '\\sigma' : 's';
  return {
    valor_num: limpio(v),
    sustitucion: {
      formula_latex: `${simbolo} = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^2}{${poblacional ? 'n' : 'n-1'}}}`,
      tipo: poblacional ? 'poblacional' : 'muestral',
      variables: { '\\bar{x}': r(c.m, d), '\\sum (x_i - \\bar{x})^2': r(c.sumaCuad, d), [poblacional ? 'n' : 'n-1']: c.divisor },
      resultado: r(v, d)
    },
    pasos: numerar([
      ...c.pasos,
      { texto: 'Saca la raíz cuadrada de la varianza para volver a las unidades originales', expresion: `√${r(c.varianza, d)}`, resultado: r(v, d) }
    ])
  };
}

// ---- COEFICIENTE DE VARIACIÓN ----
export function coeficienteVariacion({ valores: x, decimales: d }, { poblacional = false } = {}) {
  validarVarianza(x, poblacional, 'el coeficiente de variación');
  const c = calcularVarianza(x, d, poblacional);
  if (c.m <= 0) {
    throw new ErrorCalculo(
      `El coeficiente de variación solo tiene sentido cuando la media es positiva (aquí la media es ${r(c.m, d)}).`
    );
  }
  const desv = Math.sqrt(c.varianza);
  const v = (desv / c.m) * 100;
  const simbolo = poblacional ? '\\sigma' : 's';
  return {
    valor_num: limpio(v),
    sustitucion: {
      formula_latex: `CV = \\frac{${simbolo}}{\\bar{x}} \\times 100`,
      tipo: poblacional ? 'poblacional' : 'muestral',
      variables: { [simbolo]: r(desv, d), '\\bar{x}': r(c.m, d) },
      resultado: r(v, d)
    },
    pasos: numerar([
      { texto: 'Calcula la media', resultado: r(c.m, d) },
      { texto: `Calcula la desviación estándar (${poblacional ? 'poblacional' : 'muestral'})`, resultado: r(desv, d) },
      { texto: 'Divide la desviación entre la media y multiplica por 100 para expresarlo en %', expresion: `(${r(desv, d)} / ${r(c.m, d)}) × 100`, resultado: r(v, d) }
    ])
  };
}
