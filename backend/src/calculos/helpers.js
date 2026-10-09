// Error "esperado" de un cálculo (ej. muy pocos datos). Su mensaje se
// muestra tal cual al usuario, así que debe ser claro y didáctico.
export class ErrorCalculo extends Error {}

// Redondeo para MOSTRAR (pasos, sustitución). Devuelve null si no es un número finito.
export function redondear(n, decimales = 2) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const f = 10 ** decimales;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * f) / f;
}

// Redondeo para GUARDAR: solo quita el "ruido" de punto flotante (0.1 + 0.2 = 0.30000000000000004).
export const limpio = (n) => redondear(n, 10);

export function ordenar(arr) {
  return [...arr].sort((a, b) => a - b);
}

export function suma(arr) {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

// Mínimo y máximo con un bucle: Math.min(...arr) revienta la pila con arreglos grandes.
export function minMax(arr) {
  let min = Infinity, max = -Infinity;
  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

// Muestra una lista de valores para un paso del hover sin generar textos gigantes:
// con muchos datos enseña el inicio y el final ("23 + 31 + … + 28").
export function listar(valores, separador = ', ', max = 20) {
  if (valores.length <= max) return valores.join(separador);
  const inicio = valores.slice(0, max - 3).join(separador);
  const fin = valores.slice(-3).join(separador);
  return `${inicio}${separador}…${separador}${fin}`;
}

// Numera los pasos y quita los nulos/false (para pasos condicionales).
export function numerar(pasos) {
  return pasos.filter(Boolean).map((p, i) => ({ orden: i + 1, ...p }));
}

export function requerirDatos(valores, minimo, para) {
  if (valores.length < minimo) {
    throw new ErrorCalculo(
      `Se necesitan al menos ${minimo} dato${minimo === 1 ? '' : 's'} para calcular ${para} (hay ${valores.length}).`
    );
  }
}
