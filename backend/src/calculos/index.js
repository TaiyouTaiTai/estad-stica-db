import { media, mediana, moda } from './tendenciaCentral.js';
import { rango, varianza, desviacionEstandar, coeficienteVariacion } from './variabilidad.js';
import { cuartil, decil, percentil, resumenCaja } from './posicion.js';
import { mediaAgrupada, medianaAgrupada, modaAgrupada } from './agrupados.js';

export { ErrorCalculo } from './helpers.js';

// Registro de estadísticos que sabe calcular el backend.
// La clave debe coincidir con `definicion_estadistico.clave` del catálogo.
//   requiere:   'numerico' → solo columnas numéricas; 'cualquiera' → también texto
//   parametro:  si el estadístico necesita uno (ej. cuál cuartil)
//   agrupada:   versión para datos agrupados en clases (si existe)
export const ESTADISTICOS = {
  media:                 { calcular: media, requiere: 'numerico', agrupada: mediaAgrupada },
  mediana:               { calcular: mediana, requiere: 'numerico', agrupada: medianaAgrupada },
  moda:                  { calcular: moda, requiere: 'cualquiera', agrupada: modaAgrupada },
  rango:                 { calcular: rango, requiere: 'numerico' },
  varianza:              { calcular: varianza, requiere: 'numerico' },
  desviacion_estandar:   { calcular: desviacionEstandar, requiere: 'numerico' },
  coeficiente_variacion: { calcular: coeficienteVariacion, requiere: 'numerico' },
  cuartil:   { calcular: cuartil, requiere: 'numerico', parametro: { min: 1, max: 3, entero: true, porDefecto: 1 } },
  decil:     { calcular: decil, requiere: 'numerico', parametro: { min: 1, max: 9, entero: true, porDefecto: 5 } },
  percentil: { calcular: percentil, requiere: 'numerico', parametro: { min: 1, max: 99, entero: false, porDefecto: 50 } },
  resumen_caja:          { calcular: resumenCaja, requiere: 'numerico' }
};
