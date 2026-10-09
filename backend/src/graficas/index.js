import { generarDistribucion } from '../calculos/agrupados.js';
import { calcularCaja } from '../calculos/posicion.js';
import { requerirDatos, ErrorCalculo } from '../calculos/helpers.js';
import { puntosHistograma, puntosPoligono, puntosOjiva } from './histograma.js';
import { puntosCaja } from './caja.js';
import { puntosBarras, puntosPastel } from './barras.js';
import { puntosDispersion } from './dispersion.js';

// Más categorías que esto en barras/pastel ya no se puede leer
const MAX_CATEGORIAS = { barras: 40, pastel: 10 };

function distribucion(muestra, metodo) {
  return generarDistribucion(muestra.valores, {
    metodo, decimales: muestra.decimales, discreta: muestra.naturaleza === 'discreta'
  });
}

function porCategorias(tipo, muestra, generar) {
  requerirDatos(muestra.valores, 1, 'la gráfica');
  const distintas = new Set(muestra.valores).size;
  if (distintas > MAX_CATEGORIAS[tipo]) {
    throw new ErrorCalculo(
      `La columna tiene ${distintas} valores distintos: una gráfica de ${tipo} sería ilegible (máximo ${MAX_CATEGORIAS[tipo]}).`
        + (muestra.naturaleza !== 'na' ? ' Para datos numéricos usa un histograma.' : '')
    );
  }
  return generar(muestra.valores, muestra.columna);
}

// requiere: tipo de dato de la(s) columna(s). generar(muestra, opciones) → config_json
export const GRAFICAS = {
  histograma: { requiere: 'numerico', generar: (m, o) => puntosHistograma(distribucion(m, o.metodo_clases), m.columna) },
  poligono:   { requiere: 'numerico', generar: (m, o) => puntosPoligono(distribucion(m, o.metodo_clases), m.columna) },
  ojiva:      { requiere: 'numerico', generar: (m, o) => puntosOjiva(distribucion(m, o.metodo_clases), m.columna) },
  caja: {
    requiere: 'numerico',
    generar: (m) => { requerirDatos(m.valores, 4, 'el diagrama de caja'); return puntosCaja(calcularCaja(m.valores), m.columna); }
  },
  barras: { requiere: 'cualquiera', generar: (m) => porCategorias('barras', m, puntosBarras) },
  pastel: { requiere: 'cualquiera', generar: (m) => porCategorias('pastel', m, puntosPastel) },
  dispersion: {
    requiere: 'numerico',
    dosColumnas: true,
    generar: (m, o) => { requerirDatos(o.pares, 2, 'la gráfica de dispersión'); return puntosDispersion(o.pares, o.columnaX, o.columnaY); }
  }
};

export function graficasPermitidas(columna) {
  return Object.entries(GRAFICAS)
    .filter(([, g]) => g.requiere === 'cualquiera' || columna.tipo_dato === g.requiere)
    .map(([tipo]) => tipo);
}
