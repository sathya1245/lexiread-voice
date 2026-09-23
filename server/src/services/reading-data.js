/**
 * Shared read model for reading data.
 *
 * A "scope" is either a signed-in profile or an anonymous device, so the whole
 * dashboard works before a student ever creates an account (nice for a
 * classroom demo) and upgrades cleanly when they do.
 */

import { all, get, nowIso, run } from '../db.js';

export function normaliseScope({ profileId, deviceId } = {}) {
  return {
    profileId: profileId || null,
    deviceId: deviceId || null,
  };
}

/** SQL fragment matching rows that belong to the scope. */
export function scopeClause(scope, column = 'profile_id', deviceColumn = 'device_id') {
  const { profileId, deviceId } = normaliseScope(scope);
  if (profileId && deviceId) {
    return { sql: `(${column} = ? OR (${column} IS NULL AND ${deviceColumn} = ?))`, params: [profileId, deviceId] };
  }
  if (profileId) return { sql: `${column} = ?`, params: [profileId] };
  if (deviceId) return { sql: `(${column} IS NULL AND ${deviceColumn} = ?)`, params: [deviceId] };
  return { sql: '0 = 1', params: [] };
}

const sinceIso = (days) => new Date(Date.now() - days * 86400000).toISOString();

export function loadSessions(scope, { days = 90, limit = 100, includeEmpty = false } = {}) {
  const c = scopeClause(scope, 's.profile_id', 's.device_id');
  // Sessions where nothing was actually read (a page opened and abandoned)
  // are noise in the history, so they are hidden by default.
  const progress = includeEmpty ? '' : ' AND (s.words_read > 0 OR s.cursor > 0)';
  return all(
    `SELECT s.*, d.title AS title, d.kind AS kind, d.word_count AS document_words
     FROM sessions s LEFT JOIN documents d ON d.id = s.document_id
     WHERE ${c.sql} AND s.started_at >= ?${progress}
     ORDER BY s.started_at DESC LIMIT ?`,
    [...c.params, sinceIso(days), limit]
  );
}

export function loadEvents(scope, { days = 90, limit = 5000 } = {}) {
  const c = scopeClause(scope, 'e.profile_id', 'e.device_id');
  return all(
    `SELECT e.* FROM events e
     WHERE ${c.sql} AND e.created_at >= ?
     ORDER BY e.created_at DESC LIMIT ?`,
    [...c.params, sinceIso(days), limit]
  );
}

export function loadIntervals(scope, { days = 90, limit = 5000 } = {}) {
  const c = scopeClause(scope, 'i.profile_id', 'i.device_id');
  return all(
    `SELECT i.ms FROM intervals i
     WHERE ${c.sql} AND i.created_at >= ?
     ORDER BY i.created_at DESC LIMIT ?`,
    [...c.params, sinceIso(days), limit]
  );
}

export function loadDocuments(scope, { limit = 60 } = {}) {
  const c = scopeClause(scope, 'profile_id', 'device_id');
  return all(
    `SELECT id, title, kind, source, word_count, pages, meta, created_at
     FROM documents WHERE ${c.sql} ORDER BY created_at DESC LIMIT ?`,
    [...c.params, limit]
  );
}

export function getDocument(id, scope) {
  const c = scopeClause(scope, 'profile_id', 'device_id');
  return get(`SELECT * FROM documents WHERE id = ? AND ${c.sql}`, [id, ...c.params]);
}

export function createDocument({
  id,
  profileId,
  deviceId,
  title,
  source,
  kind,
  text,
  wordCount,
  pages,
  meta,
}) {
  run(
    `INSERT INTO documents (id, profile_id, device_id, title, source, kind, text, word_count, pages, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, deviceId, title, source, kind, text, wordCount, pages ?? null, JSON.stringify(meta ?? {}), nowIso()]
  );
  return get(`SELECT * FROM documents WHERE id = ?`, [id]);
}

export function createSession({ id, profileId, deviceId, documentId, mode, roomCode }) {
  run(
    `INSERT INTO sessions (id, profile_id, device_id, document_id, mode, room_code, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, deviceId, documentId, mode, roomCode ?? null, nowIso()]
  );
  return get(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

export function updateSession(id, patch) {
  const fields = [];
  const params = [];
  const map = {
    endedAt: 'ended_at',
    durationMs: 'duration_ms',
    wordsRead: 'words_read',
    cursor: 'cursor',
    wpmAvg: 'wpm_avg',
    wpmPeak: 'wpm_peak',
    mode: 'mode',
  };
  for (const [key, column] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  if (!fields.length) return get(`SELECT * FROM sessions WHERE id = ?`, [id]);
  run(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  return get(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

export function addEvents({ sessionId, profileId, deviceId, events = [] }) {
  if (!events.length) return 0;
  let inserted = 0;
  for (const e of events) {
    if (!e || !e.word) continue;
    run(
      `INSERT INTO events (session_id, profile_id, device_id, type, word, word_index, confidence, heard, at_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        profileId ?? null,
        deviceId ?? null,
        String(e.type || 'unclear'),
        String(e.word).slice(0, 80),
        Number.isFinite(e.wordIndex) ? e.wordIndex : null,
        e.confidence ?? null,
        e.heard ? String(e.heard).slice(0, 80) : null,
        Number.isFinite(e.atMs) ? e.atMs : null,
        nowIso(),
      ]
    );
    inserted += 1;
  }
  return inserted;
}

export function addIntervals({ sessionId, profileId, deviceId, intervals = [] }) {
  let inserted = 0;
  for (const ms of intervals.slice(0, 500)) {
    if (!Number.isFinite(ms) || ms < 0 || ms > 60000) continue;
    run(`INSERT INTO intervals (session_id, profile_id, device_id, ms, created_at) VALUES (?, ?, ?, ?, ?)`, [
      sessionId,
      profileId ?? null,
      deviceId ?? null,
      Math.round(ms),
      nowIso(),
    ]);
    inserted += 1;
  }
  return inserted;
}

export function eventsForSession(sessionId) {
  return all(`SELECT * FROM events WHERE session_id = ? ORDER BY id ASC`, [sessionId]);
}

/** Remove a session that never saw any reading (keeps history honest). */
export function dropSession(id) {
  run(`DELETE FROM events WHERE session_id = ?`, [id]);
  run(`DELETE FROM intervals WHERE session_id = ?`, [id]);
  run(`DELETE FROM sessions WHERE id = ?`, [id]);
}
