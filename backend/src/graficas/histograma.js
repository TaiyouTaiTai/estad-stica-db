import { limpio } from '../calculos/helpers.js';

const tabla = (dist) => ({ metodo: dist.metodo, k: dist.k, ancho: dist.ancho, n: dist.n });

export function puntosHistograma(dist, columna) {
  return {
    tipo: 'histograma',
    titulo: `Histograma de ${columna}`,
    ejes: { x: columna, y: 'Frecuencia (fi)' },
    datos: dist.clases.map(c => ({
      lim_inf: c.lim_inf, lim_sup: c.lim_sup, marca_clase: c.marca_clase, fi: c.fi, hi: c.hi, porcentaje: c.porcentaje
    })),
    distribucion: tabla(dist),
    como_leer: 'Cada barra es un intervalo de valores; su altura dice cuántos datos caen ahí. Las barras van pegadas porque los intervalos son continuos.'
  };
}

// El polígono se "cierra" en el eje X agregando una clase vacía antes y después.
export function puntosPoligono(dist, columna) {
  const primera = dist.clases[0];
  const ultima = dist.clases[dist.clases.length - 1];
  return {
    tipo: 'poligono',
    titulo: `Polígono de frecuencias de ${columna}`,
    ejes: { x: `${columna} (marca de clase)`, y: 'Frecuencia (fi)' },
    datos: [
      { x: limpio(primera.marca_clase - dist.ancho), y: 0 },
      ...dist.clases.map(c => ({ x: c.marca_clase, y: c.fi })),
      { x: limpio(ultima.marca_clase + dist.ancho), y: 0 }
    ],
    distribucion: tabla(dist),
    como_leer: 'Une los puntos medios de cada barra del histograma. Empieza y termina en cero para cerrar la figura.'
  };
}

// La ojiva arranca en (límite inferior de la primera clase, 0) y sube hasta n.
export function puntosOjiva(dist, columna) {
  return {
    tipo: 'ojiva',
    titulo: `Ojiva (frecuencia acumulada) de ${columna}`,
    ejes: { x: `${columna} (límite superior)`, y: 'Frecuencia acumulada (Fi)' },
    datos: [
      { x: dist.clases[0].lim_inf, y: 0, Hi: 0 },
      ...dist.clases.map(c => ({ x: c.lim_sup, y: c.Fi, Hi: c.Hi }))
    ],
    distribucion: tabla(dist),
    como_leer: 'Cada punto dice cuántos datos son menores que ese valor. Sirve para leer medianas y percentiles a ojo.'
  };
}
