import { ESTADISTICOS, ErrorCalculo } from '../calculos/index.js';
import { evaluarPermiso } from './permisos.js';

function resolverParametro(clave, impl, parametro) {
  if (!impl.parametro) return null;
  const { min, max, entero, porDefecto } = impl.parametro;
  const p = parametro ?? porDefecto;
  if (typeof p !== 'number' || p < min || p > max || (entero && !Number.isInteger(p))) {
    throw new ErrorCalculo(`El parámetro de ${clave} debe ser ${entero ? 'un entero' : 'un número'} entre ${min} y ${max}.`);
  }
  return p;
}

// Calcula los estadísticos pedidos sobre una columna. No toca la base de datos:
// devuelve las filas listas para guardar en resultado_estadistico.
//   errores: lo que no se pudo calcular, con un motivo entendible para el usuario
//   avisos:  notas (ej. "rango no tiene versión agrupada; se usaron los datos sin agrupar")
export function ejecutarEstadisticos({ catalogo, columna, muestra, pedidos, opciones = {} }) {
  const { agrupado = false, poblacional = false, metodo_clases = 'sturges' } = opciones;
  const resultados = [], errores = [], avisos = [];
  const datos_usados = {
    columna: muestra.columna, filas: muestra.filas, valores: muestra.valores, excluidos: muestra.excluidos
  };
  const vistos = new Set();

  for (const { clave, parametro } of pedidos) {
    const permiso = evaluarPermiso(catalogo, clave, columna);
    if (!permiso.permitido) {
      errores.push({ clave, error: permiso.motivo });
      continue;
    }
    const impl = ESTADISTICOS[clave];
    try {
      const p = resolverParametro(clave, impl, parametro);
      const id = `${clave}:${p}`;
      if (vistos.has(id)) continue; // pedido repetido
      vistos.add(id);

      const usarAgrupada = agrupado && impl.agrupada && columna.tipo_dato === 'numerico';
      if (agrupado && !usarAgrupada) {
        avisos.push(`${clave}: no tiene versión para datos agrupados; se calculó con los datos sin agrupar.`);
      }
      const calcular = usarAgrupada ? impl.agrupada : impl.calcular;
      const r = calcular(muestra, { parametro: p, poblacional, metodo_clases });

      resultados.push({
        clave,
        definicion_id: catalogo.porClave.get(clave).id,
        columna_id: columna.id,
        parametro: p,
        n_usado: muestra.valores.length,
        datos_usados,
        ...r
      });
    } catch (err) {
      if (!(err instanceof ErrorCalculo)) throw err;
      errores.push({ clave, error: err.message });
    }
  }
  return { resultados, errores, avisos };
}
