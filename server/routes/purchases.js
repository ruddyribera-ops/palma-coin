import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../helpers/db.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const purchaseSchema = z.object({
  student_id: z.number().int().positive(),
  reward_id: z.number().int().positive(),
  cost_paid: z.string().regex(/^(l|h)\d+$/, 'Formato: l### o h###'),
  approved_by: z.string().max(100).optional()
});

// POST /api/purchases
router.post('/', async (req, res) => {
  const { error, data } = validate(purchaseSchema, req.body);
  if (error) return res.status(400).json({ error });

  const student = await queryOne('SELECT * FROM students WHERE id = $1', [data.student_id]);
  const reward = await queryOne('SELECT * FROM rewards WHERE id = $1', [data.reward_id]);
  if (!student || !reward) return res.status(404).json({ error: 'No encontrado' });

  const costStr = data.cost_paid.toString();
  const isHearts = costStr.startsWith('h');
  const balanceField = isHearts ? 'hearts_balance' : 'likes_balance';
  const balance = student[balanceField] || 0;
  const cost = parseInt(costStr.replace(/^[lh]/, ''));

  if (balance < cost) return res.status(400).json({ error: 'Saldo insuficiente' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO purchases (student_id, reward_id, cost_paid, approved_by) VALUES ($1, $2, $3, $4)`,
      [data.student_id, data.reward_id, data.cost_paid, data.approved_by || 'pending']
    );
    await client.query('UPDATE rewards SET current_uses = current_uses + 1 WHERE id = $1', [data.reward_id]);
    await client.query(`UPDATE students SET ${balanceField} = ${balanceField} - $1 WHERE id = $2`, [cost, data.student_id]);
    await client.query('COMMIT');

    const updatedStudent = await queryOne('SELECT * FROM students WHERE id = $1', [data.student_id]);
    broadcast({ type: 'PURCHASE_MADE', data: { student: updatedStudent, reward } });
    res.json({ success: true, student: updatedStudent });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// GET /api/purchases
router.get('/', async (req, res) => {
  const purchases = await query(
    `SELECT p.*, s.name as student_name, r.name as reward_name
     FROM purchases p
     JOIN students s ON p.student_id = s.id
     JOIN rewards r ON p.reward_id = r.id
     ORDER BY p.purchased_at DESC LIMIT 50`
  );
  res.json(purchases);
});

export default router;
