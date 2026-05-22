import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { pool, query, queryOne } from './helpers/db.js';
import { sseMiddleware } from './helpers/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.static(join(__dirname, '../client/dist')));
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(sseMiddleware);  // SSE endpoint at GET /events

// ─── Routes ──────────────────────────────────────────────────────────────────

import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import subjectRoutes from './routes/subjects.js';
import transactionRoutes from './routes/transactions.js';
import rewardRoutes from './routes/rewards.js';
import purchaseRoutes from './routes/purchases.js';
import assemblyRoutes from './routes/assemblies.js';
import statsRoutes from './routes/stats.js';
import metricRoutes from './routes/metrics.js';
import userRoutes from './routes/users.js';

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/assemblies', assemblyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/autonomy-metrics', metricRoutes);
app.use('/api/users', userRoutes);

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

// ─── SPA fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

// ─── Database initialization ────────────────────────────────────────────────

async function initDb() {
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

  await seedIfEmpty();
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

async function dropPlainPasswordColumn() {
  try {
    await pool.query('SELECT plain_password FROM users LIMIT 1');
    await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS plain_password');
    console.log('plain_password column dropped');
  } catch (e) {
    // Column doesn't exist — nothing to do
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

// Start server even if DB init fails (SQLite fallback for local dev)
initDb().then(() => {
  server.listen(PORT, () => console.log(`🚀 Palma Coin running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('⚠️ Database unavailable, starting without DB:', err.message);
  server.listen(PORT, () => console.log(`🚀 Palma Coin running at http://localhost:${PORT} (no DB)`));
});
