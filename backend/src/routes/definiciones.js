import { Router } from 'express';
import { obtenerCatalogo } from '../services/catalogo.service.js';
import { noEncontrado } from '../lib/errores.js';

// Catálogo didáctico (público: no necesita sesión).
// El frontend lo carga una vez y lo usa para el hover junto con cada resultado.
const router = Router();

const publica = ({ id, ...def }) => def;

// GET /api/definiciones — todas, con símbolos y escalas permitidas
router.get('/definiciones', async (req, res, next) => {
  try {
    const { definiciones } = await obtenerCatalogo();
    res.json(definiciones.map(publica));
  } catch (err) {
    next(err);
  }
});

// GET /api/definiciones/:clave — ej. /api/definiciones/media
router.get('/definiciones/:clave', async (req, res, next) => {
  try {
    const def = (await obtenerCatalogo()).porClave.get(req.params.clave);
    if (!def) throw noEncontrado('Definición');
    res.json(publica(def));
  } catch (err) {
    next(err);
  }
});

// GET /api/glosario
router.get('/glosario', async (req, res, next) => {
  try {
    res.json((await obtenerCatalogo()).glosario);
  } catch (err) {
    next(err);
  }
});

export default router;
