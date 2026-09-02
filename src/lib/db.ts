import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

/**
 * Singleton mysql2 connection pool. Raw SQL only — no ORM.
 * Uses globalThis to survive Next.js hot-reload in dev.
 */
const globalForDb = globalThis as unknown as { __skylightPool?: Pool };

/**
 * Resolve connection settings from either a single DATABASE_URL
 * (e.g. mysql://user:pass@host:3306/dbname — password may be %-encoded)
 * or the discrete DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME vars.
 * DATABASE_URL wins when set. Used by the app pool and the db scripts.
 */
export function getConnectionConfig(): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const url = process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: decodeURIComponent(u.hostname) || '127.0.0.1',
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    };
  }
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 8889),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME ?? 'skylight_ballroom',
  };
}

export function getPool(): Pool {
  if (!globalForDb.__skylightPool) {
    globalForDb.__skylightPool = mysql.createPool({
      ...getConnectionConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true, // return DECIMAL as JS number (safe for our 12,2 magnitudes)
      dateStrings: true,     // return DATE/DATETIME as strings — we format explicitly
      timezone: 'Z',
    });
  }
  return globalForDb.__skylightPool;
}

/**
 * Safely coerce a value to a non-negative integer for inlining into SQL
 * (used for LIMIT/OFFSET which mysql2's binary protocol won't bind as ?).
 */
export function toInt(v: unknown, fallback = 0): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Run a SELECT and return typed rows. */
export async function query<T = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

/** Run a SELECT returning a single row (or null). */
export async function queryOne<T = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Run an INSERT/UPDATE/DELETE and return the result header. */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as ResultSetHeader;
}

/**
 * Run a set of statements inside a single transaction.
 * The callback receives a dedicated connection with the same helpers.
 */
export async function withTransaction<T>(
  fn: (tx: {
    query: <R = RowDataPacket>(sql: string, params?: unknown[]) => Promise<R[]>;
    queryOne: <R = RowDataPacket>(sql: string, params?: unknown[]) => Promise<R | null>;
    execute: (sql: string, params?: unknown[]) => Promise<ResultSetHeader>;
    conn: PoolConnection;
  }) => Promise<T>,
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const txQuery = async <R>(sql: string, params: unknown[] = []) => {
      const [rows] = await conn.execute(sql, params);
      return rows as R[];
    };
    const result = await fn({
      query: txQuery,
      queryOne: async <R>(sql: string, params: unknown[] = []) => {
        const rows = await txQuery<R>(sql, params);
        return rows[0] ?? null;
      },
      execute: async (sql: string, params: unknown[] = []) => {
        const [res] = await conn.execute(sql, params);
        return res as ResultSetHeader;
      },
      conn,
    });
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export type { RowDataPacket, ResultSetHeader };
