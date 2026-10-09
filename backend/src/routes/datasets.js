import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { env } from '../config/env.js';
import { auth } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { solicitudInvalida } from '../lib/errores.js';
import { leerExcel, leerCsv } from '../services/lectura.js';
import {
  crearDataset, reemplazarDatos, listarDatasets, obtenerDataset,
  eliminarDataset, actualizarColumna
} from '../services/dataset.service.js';
import { listarAnalisis } from '../services/analisis.service.js';
import { obtenerCatalogo } from '../services/catalogo.service.js';
import { estadisticosPermitidos } from '../services/permisos.js';
import { graficasPermitidas } from '../graficas/index.js';
import { id, idParam, tablaSchema } from './esquemas.js';

const router = Router();
router.use(auth);

// El archivo se queda en memoria: no hay archivos temporales que limpiar
const LECTORES = { '.xlsx': { leer: leerExcel, origen: 'excel' }, '.csv': { leer: leerCsv, origen: 'csv' } };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (LECTORES[ext]) return cb(null, true);
    cb(solicitudInvalida('Solo se aceptan archivos .xlsx o .csv'));
  }
});

// POST /api/datasets/archivo — subir Excel o CSV (campo "archivo", opcional "titulo")
router.post('/archivo', upload.single('archivo'), async (req, res, next) => {
  try {
    if (!req.file) throw solicitudInvalida('No se recibió ningún archivo (campo "archivo")');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const { leer, origen } = LECTORES[ext];
    const tabla = await leer(req.file.buffer);
    const titulo = req.body.titulo?.trim() || path.basename(req.file.originalname, ext);
    const creado = await crearDataset(req.usuario.id, { titulo, origen, ...tabla });
    res.status(201).json(creado);
  } catch (err) {
    next(err);
  }
});

// POST /api/datasets — tabla creada o pegada en la app: { titulo, columnas, filas }
router.post('/', validar(tablaSchema), async (req, res, next) => {
  try {
    const { titulo = 'Tabla sin título', columnas, filas } = req.body;
    const creado = await crearDataset(req.usuario.id, { titulo, origen: 'manual', columnas, filas });
    res.status(201).json(creado);
  } catch (err) {
    next(err);
  }
});

// GET /api/datasets — listar (sin los datos, solo el resumen)
router.get('/', async (req, res, next) => {
  try {
    res.json(await listarDatasets(req.usuario.id));
  } catch (err) {
    next(err);
  }
});

// GET /api/datasets/:id — datos + columnas, indicando qué cálculos y gráficas
// tienen sentido en cada columna (paso 2 del flujo en plan-db-mvp.md)
router.get('/:id', validar(idParam, 'params'), async (req, res, next) => {
  try {
    const dataset = await obtenerDataset(req.usuario.id, req.params.id);
    const catalogo = await obtenerCatalogo();
    dataset.columnas = dataset.columnas.map(c => ({
      ...c,
      estadisticos_permitidos: estadisticosPermitidos(catalogo, c),
      graficas_permitidas: graficasPermitidas(c)
    }));
    res.json(dataset);
  } catch (err) {
    next(err);
  }
});

// PUT /api/datasets/:id — reemplazar los datos (borra los análisis anteriores)
router.put('/:id', validar(idParam, 'params'), validar(tablaSchema), async (req, res, next) => {
  try {
    res.json(await reemplazarDatos(req.usuario.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/datasets/:id
router.delete('/:id', validar(idParam, 'params'), async (req, res, next) => {
  try {
    await eliminarDataset(req.usuario.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/datasets/:id/columnas/:columnaId — corregir lo detectado automáticamente.
// Ej.: una columna "satisfacción (1-5)" se detecta como razón, pero es ordinal.
// Solo estos campos se pueden cambiar (la lista blanca la impone zod con .strict()).
const columnaSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  escala: z.enum(['nominal', 'ordinal', 'intervalo', 'razon']),
  unidad: z.string().trim().max(40).nullable(),
  decimales: z.number().int().min(0).max(10)
}).partial().strict();

router.patch(
  '/:id/columnas/:columnaId',
  validar(z.object({ id, columnaId: id }), 'params'),
  validar(columnaSchema),
  async (req, res, next) => {
    try {
      res.json(await actualizarColumna(req.usuario.id, req.params.id, req.params.columnaId, req.body));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/datasets/:id/analisis — historial de análisis del dataset
router.get('/:id/analisis', validar(idParam, 'params'), async (req, res, next) => {
  try {
    await obtenerDataset(req.usuario.id, req.params.id, { conDatos: false }); // verifica que sea suyo
    res.json(await listarAnalisis(req.usuario.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

export default router;
