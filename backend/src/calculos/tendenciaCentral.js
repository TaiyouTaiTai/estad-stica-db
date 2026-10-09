import { redondear as r, limpio, ordenar, suma, listar, numerar, requerirDatos } from './helpers.js';

// Todas las funciones de cálculo reciben una "muestra":
//   { columna, valores, filas, excluidos, decimales, naturaleza }
// y devuelven { valor_num | valor_txt | valor_json, sustitucion, pasos }
// siguiendo el contrato del hover (docs/plan-db-mvp.md, sección 6).

// ---- MEDIA ARITMÉTICA ----
export function media({ valores: x, decimales: d }) {
  requerirDatos(x, 1, 'la media');
  const n = x.length;
  const s = suma(x);
  const v = s / n;
  return {
    valor_num: limpio(v),
    sustitucion: {
      formula_latex: '\\bar{x} = \\frac{\\sum x_i}{n}',
      variables: { '\\sum x_i': r(s, d), n },
      resultado: r(v, d)
    },
    pasos: numerar([
      { texto: 'Suma todos los valores', expresion: listar(x, ' + '), resultado: r(s, d) },
      { texto: 'Cuenta cuántos valores hay', resultado: n },
      { texto: 'Divide la suma entre la cantidad', expresion: `${r(s, d)} / ${n}`, resultado: r(v, d) }
    ])
  };
}

// ---- MEDIANA ----
export function mediana({ valores, decimales: d }) {
  requerirDatos(valores, 1, 'la mediana');
  const x = ordenar(valores);
  const n = x.length;
  const ordenarPaso = { texto: 'Ordena los datos de menor a mayor', expresion: listar(x) };

  if (n % 2 === 1) {
    const pos = (n + 1) / 2;
    const v = x[pos - 1];
    return {
      valor_num: limpio(v),
      sustitucion: {
        formula_latex: '\\tilde{x} = x_{(n+1)/2}',
        variables: { n, '(n+1)/2': pos },
        resultado: r(v, d)
      },
      pasos: numerar([
        ordenarPaso,
        { texto: `Hay ${n} datos (impar): la mediana es el dato del centro`, expresion: `(${n} + 1) / 2`, resultado: pos },
        { texto: `Toma el dato que está en la posición ${pos}`, resultado: r(v, d) }
      ])
    };
  }

  const a = x[n / 2 - 1];
  const b = x[n / 2];
  const v = (a + b) / 2;
  return {
    valor_num: limpio(v),
    sustitucion: {
      formula_latex: '\\tilde{x} = \\frac{x_{n/2} + x_{n/2+1}}{2}',
      variables: { n, 'x_{n/2}': a, 'x_{n/2+1}': b },
      resultado: r(v, d)
    },
    pasos: numerar([
      ordenarPaso,
      { texto: `Hay ${n} datos (par): hay dos datos en el centro, en las posiciones ${n / 2} y ${n / 2 + 1}`, expresion: `${a} y ${b}` },
      { texto: 'Promedia esos dos datos', expresion: `(${a} + ${b}) / 2`, resultado: r(v, d) }
    ])
  };
}

// ---- MODA ---- (sirve para números y para texto)
export function moda({ valores }) {
  requerirDatos(valores, 1, 'la moda');
  // Map en vez de objeto: así 1 (número) y "1" (texto) no se mezclan
  const conteo = new Map();
  for (const v of valores) conteo.set(v, (conteo.get(v) || 0) + 1);

  const tabla = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  const maxFrec = tabla[0][1];
  const modas = tabla.filter(([, f]) => f === maxFrec).map(([v]) => v);
  const tablaTexto = listar(tabla.map(([v, f]) => `${v} → ${f}`), ', ', 15);

  // Si todos los valores se repiten igual (incluido "todos aparecen una vez"), no hay moda.
  if (modas.length === conteo.size) {
    return {
      valor_num: null,
      valor_txt: null,
      valor_json: { modas: [], frecuencia: maxFrec, clasificacion: 'amodal' },
      sustitucion: { formula_latex: 'Mo = \\text{valor con mayor frecuencia}', variables: { 'f_{max}': maxFrec }, resultado: null },
      pasos: numerar([
        { texto: 'Cuenta cuántas veces aparece cada valor', expresion: tablaTexto },
        { texto: `Todos los valores aparecen el mismo número de veces (${maxFrec}): ninguno destaca, así que no hay moda`, resultado: null }
      ])
    };
  }

  const clasificacion = modas.length === 1 ? 'unimodal' : modas.length === 2 ? 'bimodal' : 'multimodal';
  const unica = modas.length === 1 ? modas[0] : null;
  const texto = modas.join(', ');
  return {
    valor_num: typeof unica === 'number' ? unica : null,
    valor_txt: typeof unica === 'number' ? null : texto.slice(0, 255),
    valor_json: { modas, frecuencia: maxFrec, clasificacion },
    sustitucion: { formula_latex: 'Mo = \\text{valor con mayor frecuencia}', variables: { 'f_{max}': maxFrec }, resultado: texto },
    pasos: numerar([
      { texto: 'Cuenta cuántas veces aparece cada valor', expresion: tablaTexto },
      { texto: 'Busca la frecuencia más alta', resultado: maxFrec },
      {
        texto: modas.length === 1
          ? 'El valor con esa frecuencia es la moda'
          : `Hay ${modas.length} valores empatados con esa frecuencia: la distribución es ${clasificacion}`,
        resultado: texto
      }
    ])
  };
}
