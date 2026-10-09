import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import pool from './config/db.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.js';
import datasetRoutes from './routes/datasets.js';
import calculoRoutes from './routes/calculos.js';
import graficaRoutes from './routes/graficas.js';
import analisisRoutes from './routes/analisis.js';
import definicionRoutes from './routes/definiciones.js';

const app = express();

app.disable('x-powered-by');
// Sin CORS_ORIGIN se permite cualquier origen (cómodo en desarrollo); en producción, configúralo
app.use(cors({ origin: env.CORS_ORIGIN.length ? env.CORS_ORIGIN : true }));
app.use(express.json({ limit: `${env.MAX_FILE_MB * 2}mb` }));

// Prueba rápida de que el servidor y la base de datos responden
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/calculos', calculoRoutes);
app.use('/api/graficas', graficaRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api', definicionRoutes); // /api/definiciones y /api/glosario

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));
app.use(errorHandler);

export default app;
