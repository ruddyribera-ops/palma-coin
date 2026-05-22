import { Router } from 'express';
import { query, queryOne } from '../helpers/db.js';

const router = Router();

// GET /api/stats
router.get('/', async (req, res) => {
  const students = await query('SELECT * FROM students ORDER BY likes_balance DESC, hearts_balance DESC');
  const totalLikes = students.reduce((sum, s) => sum + (s.likes_balance || 0), 0);
  const totalHearts = students.reduce((sum, s) => sum + (s.hearts_balance || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayResult = await queryOne(`SELECT COUNT(*) as count FROM transactions WHERE date = $1`, [todayStr]);
  const recentTransactions = await query(
    `SELECT t.*, s.name as student_name FROM transactions t
     JOIN students s ON t.student_id = s.id
     ORDER BY t.created_at DESC LIMIT 10`
  );

  res.json({
    students,
    totalLikes,
    totalHearts,
    todayCount: todayResult?.count || 0,
    recentTransactions,
    topStudents: students.slice(0, 5)
  });
});

export default router;
