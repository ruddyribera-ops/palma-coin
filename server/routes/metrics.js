import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const metricSchema = z.object({
  metric: z.string().min(1).max(200),
  value: z.number().min(0).max(1000000)
});

// GET /api/autonomy-metrics
router.get('/', async (req, res) => {
  const metrics = await query('SELECT * FROM autonomy_metrics ORDER BY recorded_at DESC LIMIT 30');
  res.json(metrics);
});

// POST /api/autonomy-metrics
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(metricSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query(
    'INSERT INTO autonomy_metrics (metric, value) VALUES ($1, $2) RETURNING *',
    [data.metric, data.value]
  );
  const record = result.rows[0];
  broadcast({ type: 'METRIC_RECORDED', data: record });
  res.json(record);
});

export default router;
