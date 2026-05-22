import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { queryOne } from '../helpers/db.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../helpers/auth.js';
import { authenticate } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 1 minuto.' }
});

// Cookie config shared between tokens
const accessCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000 // 15 minutes
};

const refreshCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { error, data } = validate(loginSchema, req.body);
  if (error) return res.status(400).json({ error });

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [data.email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(data.password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.cookie('palma_token', accessToken, accessCookieOpts);
  res.cookie('palma_refresh', refreshToken, refreshCookieOpts);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    student_id: user.student_id
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await queryOne(
    'SELECT id, email, name, role, student_id FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  res.json(user);
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('palma_token', { path: '/' });
  res.clearCookie('palma_refresh', { path: '/api/auth' });
  res.json({ success: true });
});

// POST /api/auth/refresh — issues new access token using refresh token
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.palma_refresh;
  if (!refreshToken) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = verifyToken(refreshToken);
    const accessToken = generateAccessToken(decoded);
    res.cookie('palma_token', accessToken, accessCookieOpts);
    return res.json({ success: true });
  } catch (e) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }
});

export default router;
