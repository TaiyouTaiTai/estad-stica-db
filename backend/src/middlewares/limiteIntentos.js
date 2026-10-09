// Limitador simple en memoria: máximo `max` peticiones por IP cada `ventanaMs`.
// Suficiente para un solo servidor; si algún día hay varias instancias,
// conviene moverlo a Redis o usar express-rate-limit con un store compartido.
export function limiteIntentos({ max = 10, ventanaMs = 15 * 60 * 1000 } = {}) {
  const intentos = new Map();

  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, r] of intentos) if (r.reinicio <= ahora) intentos.delete(ip);
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ahora = Date.now();
    let r = intentos.get(req.ip);
    if (!r || r.reinicio <= ahora) {
      r = { cuenta: 0, reinicio: ahora + ventanaMs };
      intentos.set(req.ip, r);
    }
    r.cuenta++;
    if (r.cuenta > max) {
      res.set('Retry-After', Math.ceil((r.reinicio - ahora) / 1000));
      return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    }
    next();
  };
}
