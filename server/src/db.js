/**
 * LexiRead persistence layer.
 *
 * Uses Node's built-in `node:sqlite` (no native build step, no external
 * service) so the whole app can run from a single `npm start`. Every table is
 * intentionally small and minimal: profiles hold no email, no birth date, no
 * real name beyond a display name chosen by the family or teacher.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let db;

export function initDb() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const file = path.join(config.dataDir, 'lexiread.db');
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      device_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS prefs (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      device_id TEXT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      pages INTEGER,
      meta TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      device_id TEXT,
      document_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      room_code TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      words_read INTEGER NOT NULL DEFAULT 0,
      cursor INTEGER NOT NULL DEFAULT 0,
      wpm_avg REAL,
      wpm_peak REAL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      profile_id TEXT,
      device_id TEXT,
      type TEXT NOT NULL,
      word TEXT NOT NULL,
      word_index INTEGER,
      confidence TEXT,
      heard TEXT,
      at_ms INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      profile_id TEXT,
      device_id TEXT,
      ms INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nudges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      from_name TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_profile_word ON events(profile_id, word);
    CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_profile ON sessions(profile_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_documents_device ON documents(device_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_nudges_room ON nudges(room_code, created_at);
  `);
  return db;
}

export function getDb() {
  if (!db) initDb();
  return db;
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export const nowIso = () => new Date().toISOString();

export function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}
