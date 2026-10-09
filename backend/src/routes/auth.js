import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../config/db.js';
import { auth, firmarToken } from '../middlewares/auth.js';
import { validar } from '../middlewares/validate.js';
import { limiteIntentos } from '../middlewares/limiteIntentos.js';

const router = Router();

const correo = z.string().trim().toLowerCase().email().max(190);

const registroSchema = z.object({
  correo,
  nombre: z.string().trim().min(2).max(120),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72) // bcrypt solo usa 72 bytes
});

const loginSchema = z.object({
  correo,
  clave: z.string().min(1).max(72)
});

// Hash de relleno: si el correo no existe igual se compara contra algo, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué correos están registrados.
const HASH_FALSO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

// POST /api/auth/registro
router.post('/registro', limiteIntentos({ max: 10 }), validar(registroSchema), async (req, res, next) => {
  try {
    const { correo, nombre, clave } = req.body;
    const hash = await bcrypt.hash(clave, 10);
    const [result] = await pool.execute(
      'INSERT INTO usuario (correo, nombre, hash_clave) VALUES (?, ?, ?)',
      [correo, nombre, hash]
    );
    const usuario = { id: result.insertId, correo, nombre };
    res.status(201).json({ token: firmarToken(usuario), usuario });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', limiteIntentos({ max: 10 }), validar(loginSchema), async (req, res, next) => {
  try {
    const { correo, clave } = req.body;
    const [rows] = await pool.execute(
      'SELECT id, correo, nombre, hash_clave FROM usuario WHERE correo = ?',
      [correo]
    );
    const usuario = rows[0];
    const valido = await bcrypt.compare(clave, usuario?.hash_clave ?? HASH_FALSO);
    if (!usuario || !valido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    res.json({
      token: firmarToken(usuario),
      usuario: { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, correo, nombre, creado_en FROM usuario WHERE id = ?',
      [req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
