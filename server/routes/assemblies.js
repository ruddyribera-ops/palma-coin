import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne } from '../helpers/db.js';
import { authenticate, requireTeacher } from '../helpers/auth.js';
import { validate } from '../helpers/validate.js';
import { broadcast } from '../helpers/sse.js';

const router = Router();

const assemblySchema = z.object({
  title: z.string().min(1, 'Título requerido').max(500),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const assemblyUpdateSchema = z.object({
  status: z.enum(['active', 'closed'])
});

const voteSchema = z.object({
  student_id: z.number().int().positive(),
  vote: z.enum(['yes', 'no', 'abstain'])
});

// GET /api/assemblies
router.get('/', async (req, res) => {
  const assemblies = await query(`
    SELECT a.*,
           COUNT(v.id) as vote_count,
           SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) as yes_votes,
           SUM(CASE WHEN v.vote = 'no' THEN 1 ELSE 0 END) as no_votes,
           SUM(CASE WHEN v.vote = 'abstain' THEN 1 ELSE 0 END) as abstain_votes
    FROM assemblies a
    LEFT JOIN assembly_votes v ON a.id = v.assembly_id
    GROUP BY a.id
    ORDER BY a.date DESC
  `);
  res.json(assemblies);
});

// POST /api/assemblies
router.post('/', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(assemblySchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query(
    'INSERT INTO assemblies (title, description, date) VALUES ($1, $2, $3) RETURNING *',
    [data.title, data.description, data.date]
  );
  const assembly = result.rows[0];
  broadcast({ type: 'ASSEMBLY_ADDED', data: assembly });
  res.json(assembly);
});

// PUT /api/assemblies/:id
router.put('/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(assemblyUpdateSchema, req.body);
  if (error) return res.status(400).json({ error });

  const result = await pool.query(
    'UPDATE assemblies SET status = $1 WHERE id = $2 RETURNING *',
    [data.status, id]
  );
  const assembly = result.rows[0];
  if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

  broadcast({ type: 'ASSEMBLY_UPDATED', data: assembly });
  res.json(assembly);
});

// GET /api/assemblies/:id/votes
router.get('/:id/votes', authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const votes = await query(
    `SELECT vote, COUNT(*) as count FROM assembly_votes
     WHERE assembly_id = $1 GROUP BY vote`,
    [id]
  );
  const assembly = await queryOne('SELECT * FROM assemblies WHERE id = $1', [id]);
  if (!assembly) return res.status(404).json({ error: 'Asamblea no encontrada' });

  res.json({ assembly, voteCounts: votes });
});

// POST /api/assemblies/:id/vote
router.post('/:id/vote', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(voteSchema, req.body);
  if (error) return res.status(400).json({ error });

  const existing = await queryOne('SELECT * FROM assembly_votes WHERE assembly_id = $1 AND student_id = $2', [id, data.student_id]);
  if (existing) return res.status(400).json({ error: 'Ya votaste' });

  await pool.query(
    'INSERT INTO assembly_votes (assembly_id, student_id, vote) VALUES ($1, $2, $3)',
    [id, data.student_id, data.vote]
  );
  const votes = await query('SELECT * FROM assembly_votes WHERE assembly_id = $1', [id]);
  broadcast({ type: 'VOTE_CAST', data: { assembly_id: id, votes } });
  res.json({ success: true, votes });
});

export default router;
