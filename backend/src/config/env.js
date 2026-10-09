import dotenv from 'dotenv';
import { z } from 'zod';
import { ARCHIVO_ENV } from './rutas.js';

// Un solo .env para todo el proyecto, en la raíz del repo
dotenv.config({ path: ARCHIVO_ENV });

// Valida las variables de entorno al arrancar: si falta algo, el servidor
// no levanta y dice exactamente qué falta (en vez de fallar a medio request).
const esquema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  CORS_ORIGIN: z.string().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES: z.string().default('7d'),
  MAX_FILE_MB: z.coerce.number().positive().default(5),
  MAX_FILAS: z.coerce.number().int().positive().default(50000),
  MAX_COLUMNAS: z.coerce.number().int().positive().default(200)
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  console.error('❌ Configuración inválida en .env:');
  for (const e of resultado.error.errors) console.error(`   - ${e.path.join('.')}: ${e.message}`);
  process.exit(1);
}

export const env = {
  ...resultado.data,
  CORS_ORIGIN: resultado.data.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
};
