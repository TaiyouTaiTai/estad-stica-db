// Valida req.body / req.params / req.query con un esquema de zod.
// Si es válido, reemplaza el valor por el ya convertido (ej. "5" → 5).
export const validar = (esquema, donde = 'body') => (req, res, next) => {
  const r = esquema.safeParse(req[donde]);
  if (!r.success) return next(r.error);
  if (donde === 'query') req.consulta = r.data; // así seguirá funcionando en Express 5, donde req.query es de solo lectura
  else req[donde] = r.data;
  next();
};
