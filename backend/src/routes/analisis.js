import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { obtenerAnalisis, eliminarAnalisis } from '../services/analisis.service.js';
import { idParam } from './esquemas.js';

const router = Router();
router.use(auth);

// GET /api/analisis/:id — resultados (con el hover) y gráficas de un análisis
router.get('/:id', validar(idParam, 'params'), async (req, res, next) => {
  try {
    res.json(await obtenerAnalisis(req.usuario.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/analisis/:id
router.delete('/:id', validar(idParam, 'params'), async (req, res, next) => {
  try {
    await eliminarAnalisis(req.usuario.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
