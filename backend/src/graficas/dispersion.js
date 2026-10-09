export function puntosDispersion(puntos, columnaX, columnaY) {
  return {
    tipo: 'dispersion',
    titulo: `${columnaY} según ${columnaX}`,
    ejes: { x: columnaX, y: columnaY },
    datos: puntos,
    como_leer: 'Cada punto es una fila de la tabla. Si los puntos forman una línea que sube, las dos variables tienden a crecer juntas; si baja, una crece cuando la otra disminuye.'
  };
}
