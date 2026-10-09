import { redondear as r, limpio, suma, minMax, numerar, requerirDatos } from './helpers.js';

const MAX_CLASES = 30;

function desviacionMuestral(x) {
  const n = x.length;
  const m = suma(x) / n;
  return Math.sqrt(suma(x.map(v => (v - m) ** 2)) / (n - 1));
}

// Redondea hacia arriba a `decimales` decimales (el ancho nunca debe quedarse corto).
function techo(n, decimales) {
  const f = 10 ** decimales;
  return Math.ceil(limpio(n * f)) / f;
}

function calcularK(x, n, rango, metodo) {
  if (metodo === 'raiz') {
    return { k: Math.ceil(Math.sqrt(n)), explicacion: 'Regla de la raíz: k = √n', expresion: `√${n}` };
  }
  if (metodo === 'scott') {
    const s = desviacionMuestral(x);
    if (s === 0) return { k: 1, explicacion: 'Regla de Scott: todos los datos son iguales, basta una clase', expresion: 's = 0' };
    const h = 3.49 * s * n ** (-1 / 3);
    return {
      k: Math.ceil(rango / h),
      explicacion: 'Regla de Scott: ancho ideal h = 3.49 · s · n^(-1/3), y k = rango / h',
      expresion: `h = 3.49 × ${r(s, 4)} × ${n}^(-1/3) = ${r(h, 4)};  k = ${r(rango, 4)} / ${r(h, 4)}`
    };
  }
  return {
    k: Math.ceil(1 + 3.322 * Math.log10(n)),
    explicacion: 'Regla de Sturges: k = 1 + 3.322 · log₁₀(n), redondeado hacia arriba',
    expresion: `1 + 3.322 × log₁₀(${n}) = ${r(1 + 3.322 * Math.log10(n), 4)}`
  };
}

// ---- DISTRIBUCIÓN DE FRECUENCIAS (tabla de clases) ----
export function generarDistribucion(x, { metodo = 'sturges', decimales = 2, discreta = false } = {}) {
  requerirDatos(x, 2, 'una tabla de frecuencias');
  const n = x.length;
  const { min, max } = minMax(x);
  const rango = max - min;
  // Con datos enteros, los límites de clase también deben ser enteros
  const precision = discreta ? 0 : decimales;

  const calc = rango === 0
    ? { k: 1, explicacion: 'Todos los datos son iguales: basta una sola clase', expresion: `rango = 0` }
    : calcularK(x, n, rango, metodo);
  const k = Math.min(Math.max(calc.k, 1), MAX_CLASES);
  const ancho = rango === 0 ? 10 ** -precision : techo(rango / k, precision);

  const clases = Array.from({ length: k }, (_, i) => {
    const limInf = limpio(min + i * ancho);
    const limSup = limpio(min + (i + 1) * ancho);
    return { orden: i + 1, lim_inf: limInf, lim_sup: limSup, marca_clase: limpio((limInf + limSup) / 2), fi: 0 };
  });

  // Cada dato cae directo en su clase (O(n)). El pequeño margen evita que
  // 0.3 / 0.1 = 2.9999999 mande un dato del borde a la clase anterior.
  for (const v of x) {
    const i = Math.min(k - 1, Math.floor((v - min) / ancho + 1e-9));
    clases[i].fi++;
  }

  let Fi = 0;
  for (const c of clases) {
    Fi += c.fi;
    c.Fi = Fi;
    c.hi = limpio(c.fi / n);
    c.Hi = limpio(Fi / n);
    c.porcentaje = r((c.fi / n) * 100, 2);
  }

  const pasos = [
    { texto: 'Cuenta los datos', resultado: n },
    { texto: 'Calcula el rango (máximo - mínimo)', expresion: `${max} - ${min}`, resultado: r(rango, decimales) },
    { texto: `Decide cuántas clases usar. ${calc.explicacion}`, expresion: calc.expresion, resultado: k },
    rango > 0 && {
      texto: `Calcula el ancho de cada clase: rango / k, redondeado hacia arriba${discreta ? ' a entero (los datos son enteros)' : ''}`,
      expresion: `${r(rango, decimales)} / ${k}`,
      resultado: ancho
    },
    {
      texto: 'Arma las clases empezando en el mínimo y cuenta cuántos datos caen en cada una (la última clase incluye su límite superior)',
      expresion: clases.map(c => `[${c.lim_inf}, ${c.lim_sup}) → ${c.fi}`).join(', ')
    }
  ];

  return { metodo, k, ancho, rango: limpio(rango), min, max, n, clases, pasos };
}

const tablaResumen = (dist) => ({
  metodo: dist.metodo, k: dist.k, ancho: dist.ancho, n: dist.n, clases: dist.clases
});

// ---- MEDIA EN DATOS AGRUPADOS ----
export function mediaAgrupada(muestra, { metodo_clases } = {}) {
  const d = muestra.decimales;
  const dist = generarDistribucion(muestra.valores, { metodo: metodo_clases, decimales: d, discreta: muestra.naturaleza === 'discreta' });
  const productos = dist.clases.map(c => c.marca_clase * c.fi);
  const s = suma(productos);
  const v = s / dist.n;
  return {
    valor_num: limpio(v),
    valor_json: { distribucion: tablaResumen(dist) },
    sustitucion: {
      formula_latex: '\\bar{x} = \\frac{\\sum m_i f_i}{n}',
      variables: { '\\sum m_i f_i': r(s, d), n: dist.n },
      resultado: r(v, d)
    },
    pasos: numerar([
      ...dist.pasos,
      { texto: 'Calcula la marca de clase (punto medio) de cada clase y multiplícala por su frecuencia', expresion: dist.clases.map(c => `${c.marca_clase} × ${c.fi}`).join(' + '), resultado: r(s, d) },
      { texto: 'Divide entre el total de datos', expresion: `${r(s, d)} / ${dist.n}`, resultado: r(v, d) }
    ])
  };
}

// ---- MEDIANA EN DATOS AGRUPADOS ----
export function medianaAgrupada(muestra, { metodo_clases } = {}) {
  const d = muestra.decimales;
  const dist = generarDistribucion(muestra.valores, { metodo: metodo_clases, decimales: d, discreta: muestra.naturaleza === 'discreta' });
  const mitad = dist.n / 2;
  const idx = dist.clases.findIndex(c => c.Fi >= mitad);
  const c = dist.clases[idx];
  const FiAnterior = idx > 0 ? dist.clases[idx - 1].Fi : 0;
  const v = c.lim_inf + ((mitad - FiAnterior) / c.fi) * dist.ancho;
  return {
    valor_num: limpio(v),
    valor_json: { distribucion: tablaResumen(dist), clase_mediana: c.orden },
    sustitucion: {
      formula_latex: 'Me = L_i + \\frac{\\frac{n}{2} - F_{i-1}}{f_i} \\cdot a',
      variables: { L_i: c.lim_inf, 'n/2': mitad, 'F_{i-1}': FiAnterior, f_i: c.fi, a: dist.ancho },
      resultado: r(v, d)
    },
    pasos: numerar([
      ...dist.pasos,
      { texto: 'Calcula la mitad de los datos', expresion: `${dist.n} / 2`, resultado: mitad },
      { texto: 'La clase mediana es la primera cuya frecuencia acumulada (Fi) alcanza esa mitad', expresion: `[${c.lim_inf}, ${c.lim_sup}) con Fi = ${c.Fi}` },
      { texto: 'Aplica la fórmula con la frecuencia acumulada de la clase anterior', expresion: `${c.lim_inf} + ((${mitad} - ${FiAnterior}) / ${c.fi}) × ${dist.ancho}`, resultado: r(v, d) }
    ])
  };
}

// ---- MODA EN DATOS AGRUPADOS ----
export function modaAgrupada(muestra, { metodo_clases } = {}) {
  const d = muestra.decimales;
  const dist = generarDistribucion(muestra.valores, { metodo: metodo_clases, decimales: d, discreta: muestra.naturaleza === 'discreta' });
  const { clases } = dist;
  let idx = 0;
  clases.forEach((c, i) => { if (c.fi > clases[idx].fi) idx = i; });
  const c = clases[idx];
  const empatadas = clases.filter(o => o.fi === c.fi).length;
  const fAnt = idx > 0 ? clases[idx - 1].fi : 0;
  const fSig = idx < clases.length - 1 ? clases[idx + 1].fi : 0;
  const d1 = c.fi - fAnt;
  const d2 = c.fi - fSig;
  // Si d1 + d2 = 0 (las vecinas tienen la misma frecuencia) la fórmula no aplica: se usa la marca de clase
  const v = d1 + d2 === 0 ? c.marca_clase : c.lim_inf + (d1 / (d1 + d2)) * dist.ancho;
  return {
    valor_num: limpio(v),
    valor_json: { distribucion: tablaResumen(dist), clase_modal: c.orden, clases_empatadas: empatadas },
    sustitucion: {
      formula_latex: 'Mo = L_i + \\frac{d_1}{d_1 + d_2} \\cdot a',
      variables: { L_i: c.lim_inf, d_1: d1, d_2: d2, a: dist.ancho },
      resultado: r(v, d)
    },
    pasos: numerar([
      ...dist.pasos,
      {
        texto: empatadas > 1
          ? `La clase modal es la de mayor frecuencia. Hay ${empatadas} clases empatadas; se toma la primera`
          : 'La clase modal es la de mayor frecuencia',
        expresion: `[${c.lim_inf}, ${c.lim_sup}) con fi = ${c.fi}`
      },
      { texto: 'd₁ = frecuencia modal - frecuencia de la clase anterior', expresion: `${c.fi} - ${fAnt}`, resultado: d1 },
      { texto: 'd₂ = frecuencia modal - frecuencia de la clase siguiente', expresion: `${c.fi} - ${fSig}`, resultado: d2 },
      d1 + d2 === 0
        ? { texto: 'Como d₁ + d₂ = 0 la fórmula no se puede aplicar: se usa la marca de clase', resultado: r(v, d) }
        : { texto: 'Aplica la fórmula', expresion: `${c.lim_inf} + (${d1} / (${d1} + ${d2})) × ${dist.ancho}`, resultado: r(v, d) }
    ])
  };
}
