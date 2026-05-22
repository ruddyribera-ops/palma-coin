import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const transactionSchema = z.object({
  student_id: z.number().int().positive(),
  type: z.enum(['like', 'heart', 'adjustment']),
  amount: z.number().int().min(1).max(1000),
  reason: z.string().max(500).optional(),
  subject_id: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha: YYYY-MM-DD')
});

const bulkTransactionSchema = z.object({
  transactions: z.array(z.object({
    student_id: z.number().int().positive(),
    type: z.enum(['like', 'heart']),
    amount: z.number().int().min(1).max(1000),
    subject_id: z.number().int().positive().optional()
  })).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// GET /api/transactions
router.get('/', async (req, res) => {
  const { student_id, date, subject_id } = req.query;
  let sql = `SELECT t.*, s.name as student_name, sub.name as subject_name
    FROM transactions t
    JOIN students s ON t.student_id = s.id
    LEFT JOIN subjects sub ON t.subject_id = sub.id
    WHERE 1=1`;
  const params = [];
  if (student_id) { sql += ` AND t.student_id = $${params.length + 1}`; params.push(student_id); }
  if (date) { sql += ` AND t.date = $${params.length + 1}`; params.push(date); }
  if (subject_id) { sql += ` AND t.subject_id = $${params.length + 1}`; params.push(subject_id); }
  sql += ' ORDER BY t.created_at DESC LIMIT 100';
  res.json(await query(sql, params));
});

// POST /api/transactions
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(transactionSchema, req.body);
  if (error) return res.status(400).json({ error });

  const balanceField = data.type === 'like' ? 'likes_balance' : 'hearts_balance';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created_by = req.headers['x-user-name'] || 'teacher';
    const txResult = await client.query(
      `INSERT INTO transactions (student_id, type, amount, reason, subject_id, date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.student_id, data.type, data.amount, data.reason || null, data.subject_id || null, data.date, created_by]
    );
    await client.query(
      `UPDATE students SET ${balanceField} = ${balanceField} + $1 WHERE id = $2`,
      [data.amount, data.student_id]
    );
    await client.query('COMMIT');

    const transaction = await queryOne(
      `SELECT t.*, s.name as student_name, sub.name as subject_name
       FROM transactions t JOIN students s ON t.student_id = s.id
       LEFT JOIN subjects sub ON t.subject_id = sub.id
       WHERE t.id = $1`,
      [txResult.rows[0].id]
    );
    const student = await queryOne('SELECT * FROM students WHERE id = $1', [data.student_id]);
    broadcast({ type: 'TRANSACTION_ADDED', data: { transaction, student } });
    res.json(transaction);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// POST /api/transactions/bulk
router.post('/bulk', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(bulkTransactionSchema, req.body);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created_by = req.headers['x-user-name'] || 'teacher';
    for (const tx of data.transactions) {
      const balanceField = tx.type === 'like' ? 'likes_balance' : 'hearts_balance';
      await client.query(
        `INSERT INTO transactions (student_id, type, amount, subject_id, date, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tx.student_id, tx.type, tx.amount, tx.subject_id || null, data.date, created_by]
      );
      await client.query(`UPDATE students SET ${balanceField} = ${balanceField} + $1 WHERE id = $2`, [tx.amount, tx.student_id]);
    }
    await client.query('COMMIT');

    const updatedStudents = await query('SELECT * FROM students ORDER BY name');
    broadcast({ type: 'BULK_TRANSACTIONS', data: { students: updatedStudents, date: data.date } });
    res.json({ success: true, updatedStudents });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export default router;
