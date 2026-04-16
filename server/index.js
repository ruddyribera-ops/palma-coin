import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from client build
app.use(express.static(join(__dirname, '../client/dist')));

let db;

async function initDb() {
  const SQL = await initSqlJs();
  const dbPath = join(__dirname, 'palma.db');

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT DEFAULT 'student',
    likes_balance INTEGER DEFAULT 0, hearts_balance INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, type TEXT NOT NULL,
    amount INTEGER NOT NULL, reason TEXT, subject_id INTEGER, date TEXT NOT NULL,
    created_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id), FOREIGN KEY (subject_id) REFERENCES subjects(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
    cost_likes INTEGER, cost_hearts INTEGER, max_uses INTEGER, current_uses INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, reward_id INTEGER NOT NULL,
    cost_paid INTEGER NOT NULL, purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP, approved_by TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id), FOREIGN KEY (reward_id) REFERENCES rewards(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS assemblies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
    date TEXT NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS assembly_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, assembly_id INTEGER NOT NULL, student_id INTEGER NOT NULL,
    vote TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assembly_id) REFERENCES assemblies(id), FOREIGN KEY (student_id) REFERENCES students(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS autonomy_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT NOT NULL, value REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, plain_password TEXT,
    name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student',
    student_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id))`);

  // Migration: Add plain_password column if it doesn't exist
  try {
    db.run("ALTER TABLE users ADD COLUMN plain_password TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Populate plain_password for existing users
  const usersWithoutPlain = getAll("SELECT * FROM users WHERE plain_password IS NULL");
  if (usersWithoutPlain.length > 0) {
    usersWithoutPlain.forEach(user => {
      if (user.role === 'teacher') {
        runQuery("UPDATE users SET plain_password = ? WHERE id = ?", ['palma2026', user.id]);
      } else {
        runQuery("UPDATE users SET plain_password = ? WHERE id = ?", ['estudiante123', user.id]);
      }
    });
    console.log(`Migrated ${usersWithoutPlain.length} users to have plain_password`);
  }

  // Seed default users
  const userCount = db.exec("SELECT COUNT(*) as count FROM users")[0]?.values[0][0] || 0;
  if (userCount === 0) {
    // Seed teacher
    const teacherHash = bcrypt.hashSync('palma2026', 10);
    db.run('INSERT INTO users (email, password, plain_password, name, role) VALUES (?, ?, ?, ?, ?)',
      ['ruddy@laspalmas.edu.bo', teacherHash, 'palma2026', 'Ruddy Ribera', 'teacher']);

    // Seed students with default password: estudiante123
    const studentHash = bcrypt.hashSync('estudiante123', 10);
    const studentNames = ['ARACENA NAVARRO', 'BONILLA PEÑA', 'GASSER PEÑA AXL', 'GONZALES MOLINA',
      'HUBNER BONADONA', 'MANRIQUE HERRERA', 'NAVIA ETIENNE', 'QUIROGA MUNDACA',
      'RIBERA TORRICO', 'SUAREZ CASTEDO', 'TABOADA MUÑOZ', 'TABOADA PADILLA',
      'VARGAS DAGA', 'VIRREIRA MENDOZA', 'ELISA SOFÍA', 'MARÍA JOSÉ GÓMEZ',
      'MONTSERRAT ROCA', 'HEIZEL GISELLE', 'CAROLINA', 'CRUZ'];

    studentNames.forEach((name, idx) => {
      const email = name.toLowerCase().replace(/ /g, '.').replace(/Á/g, 'a').replace(/É/g, 'e').replace(/Í/g, 'i').replace(/Ó/g, 'o').replace(/Ú/g, 'u').replace(/Ü/g, 'u') + '@laspalmas.edu.bo';
      db.run('INSERT INTO users (email, password, plain_password, name, role, student_id) VALUES (?, ?, ?, ?, ?, ?)',
        [email, studentHash, 'estudiante123', name, 'student', idx + 1]);
    });
    console.log('Users seeded - Teacher: ruddy@laspalmas.edu.bo / palma2026');
    console.log('Students: [name]@laspalmas.edu.bo / estudiante123');
  }

  const studentCount = db.exec("SELECT COUNT(*) as count FROM students")[0]?.values[0][0] || 0;
  if (studentCount === 0) {
    ['ARACENA NAVARRO', 'BONILLA PEÑA', 'GASSER PEÑA AXL', 'GONZALES MOLINA',
     'HUBNER BONADONA', 'MANRIQUE HERRERA', 'NAVIA ETIENNE', 'QUIROGA MUNDACA',
     'RIBERA TORRICO', 'SUAREZ CASTEDO', 'TABOADA MUÑOZ', 'TABOADA PADILLA',
     'VARGAS DAGA', 'VIRREIRA MENDOZA', 'ELISA SOFÍA', 'MARÍA JOSÉ GÓMEZ',
     'MONTSERRAT ROCA', 'HEIZEL GISELLE', 'CAROLINA', 'CRUZ'].forEach(s => db.run('INSERT INTO students (name) VALUES (?)', [s]));
  }

  const subjectCount = db.exec("SELECT COUNT(*) as count FROM subjects")[0]?.values[0][0] || 0;
  if (subjectCount === 0) {
    ['MATEMÁTICAS', 'LENGUAJE', 'INGLÉS', 'SCIENCE', 'ARTES', 'MÚSICA', 'ED. FÍSICA', 'TECNOLOGÍA', 'PORTUGUÉS', 'SOCIALES']
      .forEach(s => db.run('INSERT INTO subjects (name) VALUES (?)', [s]));
  }

  const rewardCount = db.exec("SELECT COUNT(*) as count FROM rewards")[0]?.values[0][0] || 0;
  if (rewardCount === 0) {
    db.run('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES (?, ?, ?, ?)',
      ['Salida anticipada (5 min)', 'Salir 5 minutos antes del recreo', 15, null]);
    db.run('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES (?, ?, ?, ?)',
      ['Elección de asiento', 'Elegir donde sentarse por un día', 15, null]);
    db.run('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES (?, ?, ?, ?)',
      ['Escudo de Tarea', 'Comodín para exención de una tarea', 40, null]);
    db.run('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES (?, ?, ?, ?)',
      ['Asistente del Profesor', 'Ayudar al profesor por un periodo', 60, null]);
    db.run('INSERT INTO rewards (name, description, cost_likes, cost_hearts) VALUES (?, ?, ?, ?)',
      ['Jornada Temática', 'Cine-Foro, picnic o día especial', null, 500]);
  }

  saveDb();
  console.log('Database initialized');
}

function saveDb() {
  const data = db.export();
  writeFileSync(join(__dirname, 'palma.db'), Buffer.from(data));
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function getOne(sql, params = []) {
  const results = getAll(sql, params);
  return results[0] || null;
}

const broadcast = (data) => {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(message);
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

app.use(cors());
app.use(express.json());

// AUTH
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = getOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    student_id: user.student_id
  });
});

app.get('/api/auth/me', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  const user = getOne('SELECT id, email, name, role, student_id FROM users WHERE email = ?', [email]);
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  res.json(user);
});

const isTeacher = (req, res, next) => {
  const role = req.headers['x-user-role'];
  if (role === 'teacher' || role === 'admin') return next();
  res.status(403).json({ error: 'Acceso denegado' });
};

// STUDENTS
app.get('/api/students', (req, res) => res.json(getAll('SELECT * FROM students ORDER BY name')));

app.post('/api/students', isTeacher, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  runQuery('INSERT INTO students (name) VALUES (?)', [name]);
  const student = getOne('SELECT * FROM students WHERE id = last_insert_rowid()');
  broadcast({ type: 'STUDENT_ADDED', data: student });
  res.json(student);
});

app.put('/api/students/:id', isTeacher, (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;
  runQuery('UPDATE students SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?',
    [name || null, role || null, id]);
  const student = getOne('SELECT * FROM students WHERE id = ?', [id]);
  broadcast({ type: 'STUDENT_UPDATED', data: student });
  res.json(student);
});

app.delete('/api/students/:id', isTeacher, (req, res) => {
  const { id } = req.params;
  runQuery('DELETE FROM students WHERE id = ?', [id]);
  runQuery('DELETE FROM transactions WHERE student_id = ?', [id]);
  broadcast({ type: 'STUDENT_DELETED', data: { id: parseInt(id) } });
  res.json({ success: true });
});

// SUBJECTS
app.get('/api/subjects', (req, res) => res.json(getAll('SELECT * FROM subjects ORDER BY name')));

app.post('/api/subjects', isTeacher, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  runQuery('INSERT INTO subjects (name) VALUES (?)', [name]);
  const subject = getOne('SELECT * FROM subjects WHERE id = last_insert_rowid()');
  broadcast({ type: 'SUBJECT_ADDED', data: subject });
  res.json(subject);
});

app.delete('/api/subjects/:id', isTeacher, (req, res) => {
  runQuery('DELETE FROM subjects WHERE id = ?', [req.params.id]);
  broadcast({ type: 'SUBJECT_DELETED', data: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

// TRANSACTIONS
app.get('/api/transactions', (req, res) => {
  const { student_id, date, subject_id } = req.query;
  let query = `SELECT t.*, s.name as student_name, sub.name as subject_name
    FROM transactions t JOIN students s ON t.student_id = s.id LEFT JOIN subjects sub ON t.subject_id = sub.id WHERE 1=1`;
  const params = [];
  if (student_id) { query += ' AND t.student_id = ?'; params.push(student_id); }
  if (date) { query += ' AND t.date = ?'; params.push(date); }
  if (subject_id) { query += ' AND t.subject_id = ?'; params.push(subject_id); }
  query += ' ORDER BY t.created_at DESC LIMIT 100';
  res.json(getAll(query, params));
});

app.post('/api/transactions', isTeacher, (req, res) => {
  const { student_id, type, amount, reason, subject_id, date } = req.body;
  if (!student_id || !type || !amount || !date) return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (!['like', 'heart'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

  const balanceField = type === 'like' ? 'likes_balance' : 'hearts_balance';
  runQuery(`INSERT INTO transactions (student_id, type, amount, reason, subject_id, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student_id, type, amount, reason || null, subject_id || null, date, req.headers['x-user-name'] || 'teacher']);

  const studentBefore = getOne('SELECT * FROM students WHERE id = ?', [student_id]);
  runQuery(`UPDATE students SET ${balanceField} = ? WHERE id = ?`, [(studentBefore?.[balanceField] || 0) + amount, student_id]);

  const transaction = getOne(`SELECT t.*, s.name as student_name, sub.name as subject_name FROM transactions t JOIN students s ON t.student_id = s.id LEFT JOIN subjects sub ON t.subject_id = sub.id WHERE t.id = last_insert_rowid()`);
  const student = getOne('SELECT * FROM students WHERE id = ?', [student_id]);
  broadcast({ type: 'TRANSACTION_ADDED', data: { transaction, student } });
  res.json(transaction);
});

app.post('/api/transactions/bulk', isTeacher, (req, res) => {
  const { transactions, date } = req.body;
  if (!transactions || !Array.isArray(transactions) || !date) return res.status(400).json({ error: 'Datos inválidos' });

  transactions.forEach(({ student_id, type, amount, subject_id }) => {
    if (!student_id || !type || !amount) return;
    const balanceField = type === 'like' ? 'likes_balance' : 'hearts_balance';
    runQuery(`INSERT INTO transactions (student_id, type, amount, subject_id, date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, type, amount, subject_id || null, date, req.headers['x-user-name'] || 'teacher']);
    const studentBefore = getOne('SELECT * FROM students WHERE id = ?', [student_id]);
    runQuery(`UPDATE students SET ${balanceField} = ? WHERE id = ?`, [(studentBefore?.[balanceField] || 0) + amount, student_id]);
  });

  const updatedStudents = getAll('SELECT * FROM students ORDER BY name');
  broadcast({ type: 'BULK_TRANSACTIONS', data: { students: updatedStudents, date } });
  res.json({ success: true, updatedStudents });
});

// REWARDS
app.get('/api/rewards', (req, res) => res.json(getAll('SELECT * FROM rewards WHERE active = 1 ORDER BY cost_likes, cost_hearts')));

app.post('/api/rewards', isTeacher, (req, res) => {
  const { name, description, cost_likes, cost_hearts, max_uses } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  runQuery(`INSERT INTO rewards (name, description, cost_likes, cost_hearts, max_uses) VALUES (?, ?, ?, ?, ?)`,
    [name, description, cost_likes || null, cost_hearts || null, max_uses || null]);
  const reward = getOne('SELECT * FROM rewards WHERE id = last_insert_rowid()');
  broadcast({ type: 'REWARD_ADDED', data: reward });
  res.json(reward);
});

app.put('/api/rewards/:id', isTeacher, (req, res) => {
  const { id } = req.params;
  const { name, description, cost_likes, cost_hearts, max_uses, active } = req.body;
  runQuery(`UPDATE rewards SET name = COALESCE(?, name), description = COALESCE(?, description), cost_likes = COALESCE(?, cost_likes), cost_hearts = COALESCE(?, cost_hearts), max_uses = COALESCE(?, max_uses), active = COALESCE(?, active) WHERE id = ?`,
    [name, description, cost_likes, cost_hearts, max_uses, active, id]);
  const reward = getOne('SELECT * FROM rewards WHERE id = ?', [id]);
  broadcast({ type: 'REWARD_UPDATED', data: reward });
  res.json(reward);
});

// PURCHASES
app.post('/api/purchases', (req, res) => {
  const { student_id, reward_id, cost_paid, approved_by } = req.body;
  if (!student_id || !reward_id || !cost_paid) return res.status(400).json({ error: 'Datos incompletos' });

  const student = getOne('SELECT * FROM students WHERE id = ?', [student_id]);
  const reward = getOne('SELECT * FROM rewards WHERE id = ?', [reward_id]);
  if (!student || !reward) return res.status(404).json({ error: 'No encontrado' });

  const costStr = cost_paid.toString();
  const isHearts = costStr.startsWith('h');
  const balanceField = isHearts ? 'hearts_balance' : 'likes_balance';
  const balance = student[balanceField] || 0;
  const cost = parseInt(costStr.replace(/^[lh]/, ''));

  if (balance < cost) return res.status(400).json({ error: 'Saldo insuficiente' });

  runQuery(`INSERT INTO purchases (student_id, reward_id, cost_paid, approved_by) VALUES (?, ?, ?, ?)`,
    [student_id, reward_id, cost_paid, approved_by || 'pending']);
  runQuery('UPDATE rewards SET current_uses = current_uses + 1 WHERE id = ?', [reward_id]);
  runQuery(`UPDATE students SET ${balanceField} = ? WHERE id = ?`, [balance - cost, student_id]);

  const updatedStudent = getOne('SELECT * FROM students WHERE id = ?', [student_id]);
  broadcast({ type: 'PURCHASE_MADE', data: { student: updatedStudent, reward } });
  res.json({ success: true, student: updatedStudent });
});

app.get('/api/purchases', (req, res) => {
  res.json(getAll(`SELECT p.*, s.name as student_name, r.name as reward_name FROM purchases p JOIN students s ON p.student_id = s.id JOIN rewards r ON p.reward_id = r.id ORDER BY p.purchased_at DESC LIMIT 50`));
});

// ASSEMBLIES
app.get('/api/assemblies', (req, res) => res.json(getAll('SELECT * FROM assemblies ORDER BY date DESC')));

app.post('/api/assemblies', isTeacher, (req, res) => {
  const { title, description, date } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Faltan campos' });
  runQuery('INSERT INTO assemblies (title, description, date) VALUES (?, ?, ?)', [title, description, date]);
  const assembly = getOne('SELECT * FROM assemblies WHERE id = last_insert_rowid()');
  broadcast({ type: 'ASSEMBLY_ADDED', data: assembly });
  res.json(assembly);
});

app.post('/api/assemblies/:id/vote', (req, res) => {
  const { id } = req.params;
  const { student_id, vote } = req.body;
  if (!student_id || !vote) return res.status(400).json({ error: 'Datos incompletos' });

  const existing = getOne('SELECT * FROM assembly_votes WHERE assembly_id = ? AND student_id = ?', [id, student_id]);
  if (existing) return res.status(400).json({ error: 'Ya votaste' });

  runQuery('INSERT INTO assembly_votes (assembly_id, student_id, vote) VALUES (?, ?, ?)', [id, student_id, vote]);
  const votes = getAll('SELECT * FROM assembly_votes WHERE assembly_id = ?', [id]);
  broadcast({ type: 'VOTE_CAST', data: { assembly_id: parseInt(id), votes } });
  res.json({ success: true, votes });
});

// STATS
app.get('/api/stats', (req, res) => {
  const students = getAll('SELECT * FROM students ORDER BY likes_balance DESC, hearts_balance DESC');
  const totalLikes = students.reduce((sum, s) => sum + (s.likes_balance || 0), 0);
  const totalHearts = students.reduce((sum, s) => sum + (s.hearts_balance || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayResult = getOne(`SELECT COUNT(*) as count FROM transactions WHERE date = ?`, [todayStr]);
  const recentTransactions = getAll(`SELECT t.*, s.name as student_name FROM transactions t JOIN students s ON t.student_id = s.id ORDER BY t.created_at DESC LIMIT 10`);

  res.json({ students, totalLikes, totalHearts, todayCount: todayResult?.count || 0, recentTransactions, topStudents: students.slice(0, 5) });
});

// AUTONOMY METRICS
app.get('/api/autonomy-metrics', (req, res) => res.json(getAll('SELECT * FROM autonomy_metrics ORDER BY recorded_at DESC LIMIT 30')));

app.post('/api/autonomy-metrics', isTeacher, (req, res) => {
  const { metric, value } = req.body;
  if (!metric || value === undefined) return res.status(400).json({ error: 'Datos incompletos' });
  runQuery('INSERT INTO autonomy_metrics (metric, value) VALUES (?, ?)', [metric, value]);
  const record = getOne('SELECT * FROM autonomy_metrics WHERE id = last_insert_rowid()');
  broadcast({ type: 'METRIC_RECORDED', data: record });
  res.json(record);
});

// USERS MANAGEMENT
app.get('/api/users', (req, res) => {
  res.json(getAll('SELECT id, email, plain_password, name, role, student_id FROM users ORDER BY role DESC, name ASC'));
});

app.put('/api/users/:id', isTeacher, (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;

  if (email) {
    const existing = getOne('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), id]);
    if (existing) return res.status(400).json({ error: 'Este email ya está en uso' });
    runQuery('UPDATE users SET email = ? WHERE id = ?', [email.toLowerCase().trim(), id]);
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    runQuery('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hash, password, id]);
  }

  const user = getOne('SELECT id, email, plain_password, name, role, student_id FROM users WHERE id = ?', [id]);
  broadcast({ type: 'USER_UPDATED', data: user });
  res.json(user);
});

app.get('/api/users/student/:studentId', isTeacher, (req, res) => {
  const { studentId } = req.params;
  const user = getOne('SELECT id, email, name, role, student_id FROM users WHERE student_id = ?', [studentId]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// BALANCE ADJUSTMENTS (Teacher only)
app.put('/api/students/:id/balance', isTeacher, (req, res) => {
  const { id } = req.params;
  const { likes, hearts, reason } = req.body;

  const student = getOne('SELECT * FROM students WHERE id = ?', [id]);
  if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });

  const newLikes = likes !== undefined ? likes : student.likes_balance;
  const newHearts = hearts !== undefined ? hearts : student.hearts_balance;

  runQuery('UPDATE students SET likes_balance = ?, hearts_balance = ? WHERE id = ?', [newLikes, newHearts, id]);

  if (reason) {
    runQuery(`INSERT INTO transactions (student_id, type, amount, reason, date, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'adjustment', 0, `Ajuste manual: ${reason}`, new Date().toISOString().split('T')[0], req.headers['x-user-name'] || 'teacher']);
  }

  const updated = getOne('SELECT * FROM students WHERE id = ?', [id]);
  broadcast({ type: 'BALANCE_ADJUSTED', data: { student: updated, reason } });
  res.json(updated);
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

initDb().then(() => {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`🚀 Palma Coin running at http://localhost:${PORT}`));
});