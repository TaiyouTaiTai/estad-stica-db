import { redondear } from '../calculos/helpers.js';

function contar(valores) {
  const conteo = new Map();
  for (const v of valores) conteo.set(v, (conteo.get(v) || 0) + 1);
  const n = valores.length;
  // Números en orden numérico; texto en orden alfabético
  return [...conteo.entries()]
    .sort(([a], [b]) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es')))
    .map(([categoria, frecuencia]) => ({ categoria, frecuencia, porcentaje: redondear((frecuencia / n) * 100, 2) }));
}

export function puntosBarras(valores, columna) {
  return {
    tipo: 'barras',
    titulo: `Frecuencia de ${columna}`,
    ejes: { x: columna, y: 'Frecuencia' },
    datos: contar(valores),
    como_leer: 'Cada barra es una categoría y su altura dice cuántas veces aparece. Las barras van separadas porque las categorías son independientes entre sí.'
  };
}

export function puntosPastel(valores, columna) {
  return {
    tipo: 'pastel',
    titulo: `Distribución de ${columna}`,
    datos: contar(valores),
    como_leer: 'Cada rebanada es una categoría y su tamaño es el porcentaje del total. Útil con pocas categorías; con muchas, mejor usar barras.'
  };
}
