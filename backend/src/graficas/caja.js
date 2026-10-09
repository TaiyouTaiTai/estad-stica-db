export function puntosCaja(resumen, columna) {
  return {
    tipo: 'caja',
    titulo: `Diagrama de caja de ${columna}`,
    ejes: { y: columna },
    datos: resumen,
    orientacion: 'vertical',
    como_leer: 'La caja va de Q1 a Q3 (el 50% central de los datos) y la línea interior es la mediana. Los bigotes llegan al último dato no atípico; los puntos sueltos son atípicos.'
  };
}
