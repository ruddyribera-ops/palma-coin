import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Connection pool — max 20 connections, reads DATABASE_URL from env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

const JWT_SECRET = process.env.JWT_SECRET || 'palma-coin-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

// ─── Zod schemas ────────────────────────────────────────────────────────────

// Auth
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
});

// Students
const studentSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200)
});

const studentUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['student', 'teacher', 'admin']).optional()
});

// Subjects
const subjectSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200)
});

// Transactions
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

// Rewards
const rewardSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  description: z.string().max(1000).optional(),
  cost_likes: z.number().int().min(0).optional().nullable(),
  cost_hearts: z.number().int().min(0).optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable()
});

const rewardUpdateSchema = rewardSchema.partial();

// Purchases
const purchaseSchema = z.object({
  student_id: z.number().int().positive(),
  reward_id: z.number().int().positive(),
  cost_paid: z.string().regex(/^(l|h)\d+$/, 'Formato: l### o h###'),
  approved_by: z.string().max(100).optional()
});

// Assemblies
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

// Autonomy metrics
const metricSchema = z.object({
  metric: z.string().min(1).max(200),
  value: z.number().min(0).max(1000000)
});

// Balance adjustment
const balanceSchema = z.object({
  likes: z.number().int().min(0).optional(),
  hearts: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional()
});

// User update
const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional()
});

// Helper to validate and parse
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: result.error.errors.map(e => e.message).join(', ') };
  }
  return { data: result.data };
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 1 minuto.' }
});

// Serve static files from client build
app.use(express.static(join(__dirname, '../client/dist')));

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// ─── Database helpers ───────────────────────────────────────────────────────

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ─── WebSocket setup ────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

const broadcast = (data) => {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(message);
  });
};

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

// ─── Auth helpers ──────────────────────────────────────────────────────────

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ─── Database initialization ───────────────────────────────────────────────

async function initDb() {
  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      likes_balance INTEGER DEFAULT 0,
      hearts_balance INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rewards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cost_likes INTEGER,
      cost_hearts INTEGER,
      max_uses INTEGER,
      current_uses INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
      cost_paid TEXT NOT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      approved_by TEXT)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assemblies (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assembly_votes (
      id SERIAL PRIMARY KEY,
      assembly_id INTEGER NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      vote TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assembly_id, student_id))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autonomy_metrics (
      id SERIAL PRIMARY KEY,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      plain_password TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  `);

  // Seed data
  await seedIfEmpty();

  // Drop plain_password column (Phase 2 — no longer needed with JWT auth)
  async function dropPlainPasswordColumn() {
    try {
      // Check if column exists by trying to select it
      await pool.query('SELECT plain_password FROM users LIMIT 1');
      // If we got here, column exists — drop it
      await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS plain_password');
      console.log('plain_password column dropped');
    } catch (e) {
      // Column doesn't exist — nothing to do
    }
  }
  await dropPlainPasswordColumn();

  console.log('Database initialized');
}

async function seedIfEmpty() {
  const studentCountRes = await pool.query('SELECT COUNT(*) FROM students');
  if (parseInt(studentCountRes.rows[0].count) === 0) {
    const studentNames = [
      'ARACENA NAVARRO', 'BONILLA PEÑA', 'GASSER PEÑA AXL', 'GONZALES MOLINA',
      'HUBNER BONADONA', 'MANRIQUE HERRERA', 'NAVIA ETIENNE', 'QUIROGA MUNDACA',
      'RIBERA TORRICO', 'SUAREZ CASTEDO', 'TABOADA MUÑOZ', 'TABOADA PADILLA',
      'VARGAS DAGA', 'VIRREIRA MENDOZA', 'ELISA SOFÍA', 'MARÍA JOSÉ GÓMEZ',
      'MONTSERRAT ROCA', 'HEIZEL GISELLE', 'CAROLINA', 'CRUZ'
    ];
    for (const name of studentNames) {
      await pool.query('INSERT INTO students (name) VALUES ($1)', [name]);
    }
    console.log('Students seeded');
  }

  const subjectCountRes = await pool.query('SELECT COUNT(*) FROM subjects');
  if (parseInt(subjectCountRes.rows[0].count) === 0) {
    const subjects = ['MATEMÁTICAS', 'LENGUAJE', 'INGLÉS', 'SCIENCE', 'ARTES', 'MÚSICA', 'ED. FÍSICA', 'TECNOLOGÍA', 'PORTUGUÉS', 'SOCIALES'];
    for (const name of subjects) {
      await pool.query('INSERT INTO subjects (name) VALUES ($1)', [name]);
    }
    console.log('Subjects seeded');
  }

  const rewardCountRes = await pool.query('SELECT COUNT(*) FROM rewards');
  if (parseInt(rewardCountRes.rows[0].count) === 0) {
    const rewards = [
      ['Salida anticipada (5 min)', 'Salir 5 minutos antes del recreo', 15, null],
      ['Elección de asiento', 'Elegir donde sentarse por un día', 15, null],
      ['Escudo de Tarea', 'Comodín para exención de una tarea', 40, null],
      ['Asistente del Profesor', 'Ayudar al profesor por un periodo', 60, null],
      ['Jornada Temática', 'Cine-Foro, picnic o día especial', null, 500]
    ];
    for (const [name, description, cost_likes, cost_hearts] of rewards) {
      await pool.query('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES ($1, $2, $3, $4)',
        [name, description, cost_likes, cost_hearts]);
    }
    console.log('Rewards seeded');
  }

  const userCountRes = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(userCountRes.rows[0].count) === 0) {
    const teacherHash = bcrypt.hashSync('palma2026', 10);
    await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
      ['ruddy@laspalmas.edu.bo', teacherHash, 'Ruddy Ribera', 'teacher']
    );

    const studentHash = bcrypt.hashSync('estudiante123', 10);
    const studentNames = [
      'ARACENA NAVARRO', 'BONILLA PEÑA', 'GASSER PEÑA AXL', 'GONZALES MOLINA',
      'HUBNER BONADONA', 'MANRIQUE HERRERA', 'NAVIA ETIENNE', 'QUIROGA MUNDACA',
      'RIBERA TORRICO', 'SUAREZ CASTEDO', 'TABOADA MUÑOZ', 'TABOADA PADILLA',
      'VARGAS DAGA', 'VIRREIRA MENDOZA', 'ELISA SOFÍA', 'MARÍA JOSÉ GÓMEZ',
      'MONTSERRAT ROCA', 'HEIZEL GISELLE', 'CAROLINA', 'CRUZ'
    ];

    for (let idx = 0; idx < studentNames.length; idx++) {
      const name = studentNames[idx];
      const email = name.toLowerCase()
        .replace(/ /g, '.').replace(/Á/g, 'a').replace(/É/g, 'e')
        .replace(/Í/g, 'i').replace(/Ó/g, 'o').replace(/Ú/g, 'u').replace(/Ü/g, 'u')
        + '@laspalmas.edu.bo';
      await pool.query(
        'INSERT INTO users (email, password, name, role, student_id) VALUES ($1, $2, $3, $4, $5)',
        [email, studentHash, name, 'student', idx + 1]
      );
    }
    console.log('Users seeded — Teacher: ruddy@laspalmas.edu.bo / palma2026');
    console.log('Students: [name]@laspalmas.edu.bo / estudiante123');
  }
}

// ─── Auth middleware ────────────────────────────────────────────────────────

// Authenticate — verifies JWT from httpOnly cookie only (Phase 3: header fallback removed — spoofing risk)
async function authenticate(req, res, next) {
  // JWT from httpOnly cookie — the only trusted auth mechanism
  const token = req.cookies.palma_token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// requireTeacher — checks req.user.role after authenticate() runs
function requireTeacher(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'teacher' || req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Acceso denegado' });
}

// ─── Health endpoints ────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

app.get('/version', (req, res) => {
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
    env: process.env.NODE_ENV
  });
});

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { error, data } = validate(loginSchema, req.body);
  if (error) return res.status(400).json({ error });

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [data.email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(data.password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = generateToken(user);
  res.cookie('palma_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    student_id: user.student_id
  });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await queryOne(
    'SELECT id, email, name, role, student_id FROM users WHERE id = $1',
    [req.user.userId]
  );
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  res.json(user);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('palma_token');
  res.json({ success: true });
});

// ─── Students ───────────────────────────────────────────────────────────────

app.get('/api/students', async (req, res) => {
  const students = await query('SELECT * FROM students ORDER BY name');
  res.json(students);
});

app.post('/api/students', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(studentSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query('INSERT INTO students (name) VALUES ($1) RETURNING *', [data.name]);
  const student = result.rows[0];
  broadcast({ type: 'STUDENT_ADDED', data: student });
  res.json(student);
});

app.put('/api/students/:id', authenticate, requireTeacher, async (req, res) => {
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

app.delete('/api/students/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  await pool.query('DELETE FROM students WHERE id = $1', [id]);
  broadcast({ type: 'STUDENT_DELETED', data: { id } });
  res.json({ success: true });
});

// ─── Subjects ───────────────────────────────────────────────────────────────

app.get('/api/subjects', async (req, res) => {
  const subjects = await query('SELECT * FROM subjects ORDER BY name');
  res.json(subjects);
});

app.post('/api/subjects', authenticate, requireTeacher, async (req, res) => {
  const { error, data } = validate(subjectSchema, req.body);
  if (error) return res.status(400).json({ error });
  const result = await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING *', [data.name]);
  const subject = result.rows[0];
  broadcast({ type: 'SUBJECT_ADDED', data: subject });
  res.json(subject);
});

app.delete('/api/subjects/:id', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  await pool.query('DELETE FROM subjects WHERE id = $1', [id]);
  broadcast({ type: 'SUBJECT_DELETED', data: { id } });
  res.json({ success: true });
});

// ─── Transactions ───────────────────────────────────────────────────────────

app.get('/api/transactions', async (req, res) => {
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

app.post('/api/transactions', authenticate, requireTeacher, async (req, res) => {
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

app.post('/api/transactions/bulk', authenticate, requireTeacher, async (req, res) => {
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

// ─── Rewards ────────────────────────────────────────────────────────────────

app.get('/api/rewards', async (req, res) => {
  const rewards = await query('SELECT * FROM rewards WHERE active = 1 ORDER BY cost_likes, cost_hearts');
  res.json(rewards);
});

app.post('/api/rewards', authenticate, requireTeacher, async (req, res) => {
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

app.put('/api/rewards/:id', authenticate, requireTeacher, async (req, res) => {
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

// ─── Purchases ──────────────────────────────────────────────────────────────

app.post('/api/purchases', async (req, res) => {
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

app.get('/api/purchases', async (req, res) => {
  const purchases = await query(
    `SELECT p.*, s.name as student_name, r.name as reward_name
     FROM purchases p
     JOIN students s ON p.student_id = s.id
     JOIN rewards r ON p.reward_id = r.id
     ORDER BY p.purchased_at DESC LIMIT 50`
  );
  res.json(purchases);
});

// ─── Assemblies ─────────────────────────────────────────────────────────────

app.get('/api/assemblies', async (req, res) => {
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

app.post('/api/assemblies', authenticate, requireTeacher, async (req, res) => {
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

app.put('/api/assemblies/:id', authenticate, requireTeacher, async (req, res) => {
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

app.get('/api/assemblies/:id/votes', authenticate, async (req, res) => {
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

app.post('/api/assemblies/:id/vote', async (req, res) => {
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

// ─── Stats ───────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
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

  res.json({ students, totalLikes, totalHearts, todayCount: todayResult?.count || 0, recentTransactions, topStudents: students.slice(0, 5) });
});

// ─── Autonomy metrics ────────────────────────────────────────────────────────

app.get('/api/autonomy-metrics', async (req, res) => {
  const metrics = await query('SELECT * FROM autonomy_metrics ORDER BY recorded_at DESC LIMIT 30');
  res.json(metrics);
});

app.post('/api/autonomy-metrics', authenticate, requireTeacher, async (req, res) => {
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

// ─── Users management ────────────────────────────────────────────────────────

app.get('/api/users', authenticate, requireTeacher, async (req, res) => {
  const users = await query('SELECT id, email, name, role, student_id FROM users ORDER BY role DESC, name ASC');
  res.json(users);
});

app.put('/api/users/:id', authenticate, requireTeacher, async (req, res) => {
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

app.get('/api/users/student/:studentId', authenticate, requireTeacher, async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  if (isNaN(studentId) || studentId < 1) return res.status(400).json({ error: 'ID inválido' });

  const user = await queryOne('SELECT id, email, name, role, student_id FROM users WHERE student_id = $1', [studentId]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// ─── Balance adjustments ────────────────────────────────────────────────────

app.put('/api/students/:id/balance', authenticate, requireTeacher, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });

  const { error, data } = validate(balanceSchema, req.body);
  if (error) return res.status(400).json({ error });

  const student = await queryOne('SELECT * FROM students WHERE id = $1', [id]);
  if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

  // Check balance floors — reject if either balance would go negative
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

// ─── SPA fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  server.listen(PORT, () => console.log(`🚀 Palma Coin running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});