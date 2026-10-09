import { ESTADISTICOS } from '../calculos/index.js';

// ¿Se puede calcular `clave` sobre esta columna? Devuelve { permitido, motivo }.
// Combina el tipo de dato (lo que el código sabe calcular) con la escala
// (lo que el catálogo dice que tiene sentido estadísticamente).
export function evaluarPermiso(catalogo, clave, columna) {
  const def = catalogo.porClave.get(clave);
  const impl = ESTADISTICOS[clave];
  if (!def || !impl) {
    return { permitido: false, motivo: `"${clave}" no está disponible en el catálogo` };
  }
  if (impl.requiere === 'numerico' && columna.tipo_dato !== 'numerico') {
    return { permitido: false, motivo: `${def.nombre} necesita números y la columna "${columna.nombre}" es de tipo ${columna.tipo_dato}.` };
  }
  const regla = def.escalas[columna.escala];
  if (!regla) {
    return { permitido: false, motivo: `El catálogo no indica si ${def.nombre} aplica a la escala ${columna.escala}.` };
  }
  return regla;
}

export function estadisticosPermitidos(catalogo, columna) {
  return catalogo.definiciones
    .filter(d => d.calculable && evaluarPermiso(catalogo, d.clave, columna).permitido)
    .map(d => d.clave);
}
