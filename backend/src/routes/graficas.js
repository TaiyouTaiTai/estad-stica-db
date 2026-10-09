import { Router } from 'express';
import { z } from 'zod';
import { enTransaccion } from '../config/db.js';
import { auth } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { solicitudInvalida } from '../lib/errores.js';
import { obtenerDataset, buscarColumna, extraerMuestra, extraerPares } from '../services/dataset.service.js';
import { prepararAnalisis, guardarGrafica } from '../services/analisis.service.js';
import { GRAFICAS } from '../graficas/index.js';
import { id, metodoClases } from './esquemas.js';

const router = Router();

const graficaSchema = z.object({
  dataset_id: id,
  tipo: z.enum(Object.keys(GRAFICAS)),
  columna_id: id,
  columna_b_id: id.optional(), // solo para dispersión (eje Y)
  analisis_id: id.optional(),
  nombre: z.string().trim().max(150).optional(),
  metodo_clases: metodoClases
});

function exigirTipo(columna, requiere, tipo) {
  if (requiere === 'numerico' && columna.tipo_dato !== 'numerico') {
    throw solicitudInvalida(`La gráfica de ${tipo} necesita una columna numérica y "${columna.nombre}" es de tipo ${columna.tipo_dato}.`);
  }
}

// POST /api/graficas — genera los datos de la gráfica (listos para Recharts/Chart.js)
// y los guarda en grafica.config_json dentro de un análisis.
router.post('/', auth, validar(graficaSchema), async (req, res, next) => {
  try {
    const { dataset_id, tipo, columna_id, columna_b_id, analisis_id, nombre, metodo_clases } = req.body;
    const usuarioId = req.usuario.id;
    const def = GRAFICAS[tipo];

    const dataset = await obtenerDataset(usuarioId, dataset_id);
    const columna = buscarColumna(dataset, columna_id);
    exigirTipo(columna, def.requiere, tipo);

    const opciones = { metodo_clases };
    if (def.dosColumnas) {
      if (!columna_b_id) throw solicitudInvalida('La dispersión necesita una segunda columna (columna_b_id)');
      const columnaB = buscarColumna(dataset, columna_b_id);
      exigirTipo(columnaB, def.requiere, tipo);
      Object.assign(opciones, {
        pares: extraerPares(dataset, columna, columnaB), columnaX: columna.nombre, columnaY: columnaB.nombre
      });
    }

    const config = def.generar(extraerMuestra(dataset, columna), opciones);

    const r = await enTransaccion(async (conn) => {
      const aId = await prepararAnalisis(conn, { usuarioId, datasetId: dataset_id, analisisId: analisis_id, nombre });
      const gId = await guardarGrafica(conn, aId, {
        tipo, columna_id, columna_b_id: def.dosColumnas ? columna_b_id : null, config
      });
      return { analisis_id: aId, id: gId };
    });

    res.status(201).json({
      analisis_id: r.analisis_id,
      grafica: { id: r.id, tipo, columna_id, columna_b_id: def.dosColumnas ? columna_b_id : null, config }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
