import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const rewardSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  description: z.string().max(1000).optional(),
  cost_likes: z.number().int().min(0).optional().nullable(),
  cost_hearts: z.number().int().min(0).optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable()
});

const rewardUpdateSchema = rewardSchema.partial();

// GET /api/rewards
router.get('/', async (req, res) => {
  const rewards = await query('SELECT * FROM rewards WHERE active = 1 ORDER BY cost_likes, cost_hearts');
  res.json(rewards);
});

// POST /api/rewards
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(rewardSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query(
    `INSERT INTO rewards (name, description, cost_likes, cost_hearts, max_uses) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.description, data.cost_likes, data.cost_hearts, data.max_uses]
  );
  const reward = result.rows[0];
  broadcast({ type: 'REWARD_ADDED', data: reward });
  res.json(reward);
});

// PUT /api/rewards/:id
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(rewardUpdateSchema, req.body);
  if (error) return res.status(400).json({ error });

  const result = await pool.query(
    `UPDATE rewards SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       cost_likes = COALESCE($3, cost_likes),
       cost_hearts = COALESCE($4, cost_hearts),
       max_uses = COALESCE($5, max_uses),
       active = COALESCE($6, active)
     WHERE id = $7 RETURNING *`,
    [data.name, data.description, data.cost_likes, data.cost_hearts, data.max_uses, data.active, id]
  );
  const reward = result.rows[0];
  if (reward) broadcast({ type: 'REWARD_UPDATED', data: reward });
  res.json(reward);
});

export default router;
