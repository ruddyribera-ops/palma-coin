import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const studentSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200)
});

const studentUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['student', 'teacher', 'admin']).optional()
});

const balanceSchema = z.object({
  likes: z.number().int().min(0).optional(),
  hearts: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional()
});

// GET /api/students
router.get('/', async (req, res) => {
  const students = await query('SELECT * FROM students ORDER BY name');
  res.json(students);
});

// POST /api/students
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(studentSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query('INSERT INTO students (name) VALUES ($1) RETURNING *', [data.name]);
  const student = result.rows[0];
  broadcast({ type: 'STUDENT_ADDED', data: student });
  res.json(student);
});

// PUT /api/students/:id
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(studentUpdateSchema, req.body);
  if (error) return res.status(400).json({ error });

  const result = await pool.query(
    'UPDATE students SET name = COALESCE($1, name), role = COALESCE($2, role) WHERE id = $3 RETURNING *',
    [data.name || null, data.role || null, id]
  );
  const student = result.rows[0];
  if (student) broadcast({ type: 'STUDENT_UPDATED', data: student });
  res.json(student);
});

// DELETE /api/students/:id
router.delete('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  await pool.query('DELETE FROM students WHERE id = $1', [id]);
  broadcast({ type: 'STUDENT_DELETED', data: { id } });
  res.json({ success: true });
});

// PUT /api/students/:id/balance
router.put('/:id/balance', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(balanceSchema, req.body);
  if (error) return res.status(400).json({ error });

  const student = await queryOne('SELECT * FROM students WHERE id = $1', [id]);
  if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

  if (data.likes !== undefined && data.likes < 0) {
    return res.status(400).json({ error: 'El balance de likes no puede ser negativo' });
  }
  if (data.hearts !== undefined && data.hearts < 0) {
    return res.status(400).json({ error: 'El balance de hearts no puede ser negativo' });
  }

  const newLikes = data.likes !== undefined ? data.likes : student.likes_balance;
  const newHearts = data.hearts !== undefined ? data.hearts : student.hearts_balance;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE students SET likes_balance = $1, hearts_balance = $2 WHERE id = $3', [newLikes, newHearts, id]);

    if (data.reason) {
      await client.query(
        `INSERT INTO transactions (student_id, type, amount, reason, date, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, 'adjustment', 0, `Ajuste manual: ${data.reason}`, new Date().toISOString().split('T')[0], req.headers['x-user-name'] || 'teacher']
      );
    }
    await client.query('COMMIT');

    const updated = await queryOne('SELECT * FROM students WHERE id = $1', [id]);
    broadcast({ type: 'BALANCE_ADJUSTED', data: { student: updated, reason: data.reason } });
    res.json(updated);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export default router;
