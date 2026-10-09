import { Router } from 'express';
import { z } from 'zod';
import { enTransaccion } from '../config/db.js';
import { auth } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { obtenerDataset, buscarColumna, extraerMuestra } from '../services/dataset.service.js';
import { obtenerCatalogo } from '../services/catalogo.service.js';
import { ejecutarEstadisticos } from '../services/calculo.service.js';
import { prepararAnalisis, guardarResultados, obtenerAnalisis } from '../services/analisis.service.js';
import { id, metodoClases } from './esquemas.js';

const router = Router();

// Cada estadístico puede pedirse como "media" o como { clave: "cuartil", parametro: 3 }
const pedido = z.union([
  z.string().transform(clave => ({ clave })),
  z.object({ clave: z.string(), parametro: z.number().optional() })
]);

const calculoSchema = z.object({
  dataset_id: id,
  columna_id: id,
  analisis_id: id.optional(),          // para agregar resultados a un análisis existente
  nombre: z.string().trim().max(150).optional(),
  estadisticos: z.array(pedido).min(1).max(30),
  agrupado: z.boolean().default(false), // usar la tabla de frecuencias (media/mediana/moda agrupadas)
  metodo_clases: metodoClases,
  poblacional: z.boolean().default(false) // varianza/desviación: n en vez de n-1
});

// POST /api/calculos
// Calcula, guarda en analisis + resultado_estadistico y devuelve el análisis
// completo con los datos del hover (sustitucion, pasos, datos_usados).
router.post('/', auth, validar(calculoSchema), async (req, res, next) => {
  try {
    const { dataset_id, columna_id, analisis_id, nombre, estadisticos, ...opciones } = req.body;
    const usuarioId = req.usuario.id;

    const dataset = await obtenerDataset(usuarioId, dataset_id);
    const columna = buscarColumna(dataset, columna_id);
    const catalogo = await obtenerCatalogo();
    const muestra = extraerMuestra(dataset, columna);

    const { resultados, errores, avisos } = ejecutarEstadisticos({
      catalogo, columna, muestra, pedidos: estadisticos, opciones
    });
    if (resultados.length === 0) {
      return res.status(422).json({ error: 'No se pudo calcular ninguno de los estadísticos pedidos', errores });
    }

    const analisisId = await enTransaccion(async (conn) => {
      const aId = await prepararAnalisis(conn, { usuarioId, datasetId: dataset_id, analisisId: analisis_id, nombre });
      await guardarResultados(conn, aId, resultados);
      return aId;
    });

    res.status(201).json({ analisis: await obtenerAnalisis(usuarioId, analisisId), errores, avisos });
  } catch (err) {
    next(err);
  }
});

export default router;
