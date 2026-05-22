import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool, query, queryOne } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional()
});

// GET /api/users
router.get('/', authenticate, requireTeacher, async (req, res) => {
  const users = await query('SELECT id, email, name, role, student_id FROM users ORDER BY role DESC, name ASC');
  res.json(users);
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(userUpdateSchema, req.body);
  if (error) return res.status(400).json({ error });

  if (data.email) {
    const existing = await queryOne('SELECT id FROM users WHERE email = $1 AND id != $2', [data.email.toLowerCase(), id]);
    if (existing) return res.status(400).json({ error: 'Este email ya está en uso' });
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [data.email.toLowerCase().trim(), id]);
  }

  if (data.password) {
    const hash = bcrypt.hashSync(data.password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, id]);
  }

  const user = await queryOne('SELECT id, email, name, role, student_id FROM users WHERE id = $1', [id]);
  if (user) broadcast({ type: 'USER_UPDATED', data: user });
  res.json(user);
});

// GET /api/users/student/:studentId
router.get('/student/:studentId', authenticate, requireTeacher, async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  if (isNaN(studentId) || studentId < 1) return res.status(400).json({ error: 'ID inválido' });

  const user = await queryOne('SELECT id, email, name, role, student_id FROM users WHERE student_id = $1', [studentId]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

export default router;
