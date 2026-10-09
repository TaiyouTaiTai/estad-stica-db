import { z } from 'zod';

// Esquemas de validación compartidos entre rutas.

export const id = z.coerce.number().int().positive();

export const idParam = z.object({ id });

// Una celda puede ser número, texto, booleano o vacía
const celda = z.union([z.number(), z.string().max(1000), z.boolean(), z.null()]);

// Mismo formato que dataset.datos_json
export const tablaSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  columnas: z.array(z.union([z.string().max(150), z.null()])).min(1),
  filas: z.array(z.array(celda)).min(1)
});

export const metodoClases = z.enum(['sturges', 'raiz', 'scott']).default('sturges');
