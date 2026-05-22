import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const subjectSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200)
});

// GET /api/subjects
router.get('/', async (req, res) => {
  const subjects = await query('SELECT * FROM subjects ORDER BY name');
  res.json(subjects);
});

// POST /api/subjects
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(subjectSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING *', [data.name]);
  const subject = result.rows[0];
  broadcast({ type: 'SUBJECT_ADDED', data: subject });
  res.json(subject);
});

// DELETE /api/subjects/:id
router.delete('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  await pool.query('DELETE FROM subjects WHERE id = $1', [id]);
  broadcast({ type: 'SUBJECT_DELETED', data: { id } });
  res.json({ success: true });
});

export default router;
