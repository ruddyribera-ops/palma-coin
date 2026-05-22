// Database helper — PostgreSQL via pg when DATABASE_URL is set, SQLite via better-sqlite3 for local dev.

let dbType = 'none';
let pgPool = null;
let sqliteDb = null;

export async function initDbDriver() {
  if (process.env.DATABASE_URL) {
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    dbType = 'postgres';
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
    console.log('📀 Using PostgreSQL');
  } else {
    const Database = (await import('better-sqlite3')).default;
    dbType = 'sqlite';
    sqliteDb = new Database(process.env.SQLITE_PATH || './palma_local.db');
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
    console.log('📀 Using SQLite (local dev)');
  }
}

export async function query(sql, params = []) {
  if (dbType === 'postgres') {
    const result = await pgPool.query(sql, params);
    return result.rows;
  }

  if (dbType === 'sqlite') {
    const sqliteSql = sql.replace(/\$(\d+)/g, '?');
    const upper = sql.trim().toUpperCase();

    // Handle INSERT ... RETURNING *
    const insertReturning = sql.match(/INSERT\s+INTO\s+(\w+)\s+.*RETURNING\s+(.+)/i);
    if (insertReturning) {
      const tableName = insertReturning[1];
      const insertSql = sql.replace(/RETURNING\s+.+/i, '');
      const stmt = sqliteDb.prepare(insertSql.replace(/\$(\d+)/g, '?'));
      const info = stmt.run(...params);
      const row = sqliteDb.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(info.lastInsertRowid);
      return row ? [row] : [];
    }

    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
      return sqliteDb.prepare(sqliteSql).all(...params);
    }

    sqliteDb.prepare(sqliteSql).run(...params);
    return [];
  }

  return [];
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Proxy pool that works for both PostgreSQL and SQLite
// Routes can use pool.query() and it'll delegate to the right engine
export const pool = new Proxy({}, {
  get(target, prop) {
    if (prop === 'query') {
      return async (sql, params) => {
        if (dbType === 'postgres') {
          return await pgPool.query(sql, params);
        }
        if (dbType === 'sqlite') {
          const rows = await query(sql, params);
          return { rows };
        }
        return { rows: [] };
      };
    }
    if (prop === 'connect') {
      return async () => {
        if (dbType === 'postgres') return await pgPool.connect();
        // SQLite: return a fake client that runs queries directly via query()
        return {
          query: async (sql, params) => {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              sqliteDb.exec(sql);
              return { rows: [] };
            }
            const rows = await query(sql, params || []);
            return { rows };
          },
          release: () => {}
        };
      };
    }
    // For pool.end, etc.
    return pgPool ? pgPool[prop] : undefined;
  }
});

export { dbType };
export default { query, queryOne, dbType, pool, initDbDriver };
