/**
 * QR handoff: package a reading position + preferences, hand it to another
 * device with a short code. No account needed on the receiving device — the
 * code is the only key, and it expires.
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import { newId } from '../auth.js';
import { config } from '../config.js';
import { get, nowIso, run } from '../db.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { requireProfile } from '../auth.js';

export const handoffRouter = Router();

/** Unambiguous alphabet (no O/0, I/1) — easier to type from a QR backup. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(len = 6) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function pruneExpired() {
  run(`DELETE FROM handoffs WHERE expires_at < ?`, [nowIso()]);
}

handoffRouter.post(
  '/handoff',
  asyncHandler((req, res) => {
    const { payload, ttlMs } = req.body || {};
    if (!payload || typeof payload !== 'object') throw badRequest('Nothing to hand over.');
    pruneExpired();
    const code = makeCode();
    const expiresAt = new Date(Date.now() + Math.min(ttlMs || config.handoffTtlMs, 86400000)).toISOString();
    run(`INSERT INTO handoffs (code, payload, created_at, expires_at) VALUES (?, ?, ?, ?)`, [
      code,
      JSON.stringify({ ...payload, id: newId('h_') }),
      nowIso(),
      expiresAt,
    ]);
    res.status(201).json({ code, expiresAt });
  })
);

handoffRouter.get(
  '/handoff/:code',
  asyncHandler((req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const row = get(`SELECT * FROM handoffs WHERE code = ?`, [code]);
    if (!row) throw notFound('That code is not valid any more. Ask for a new QR code.');
    if (row.expires_at < nowIso()) {
      run(`DELETE FROM handoffs WHERE code = ?`, [code]);
      throw notFound('That code has expired. Ask for a new QR code.');
    }
    res.json({ payload: JSON.parse(row.payload), expiresAt: row.expires_at });
  })
);

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export const prefsRouter = Router();

prefsRouter.get(
  '/prefs',
  asyncHandler((req, res) => {
    if (!req.profile) return res.json({ prefs: null, scope: 'device' });
    const row = get(`SELECT json, updated_at FROM prefs WHERE profile_id = ?`, [req.profile.id]);
    res.json({ prefs: row ? JSON.parse(row.json) : null, updatedAt: row?.updated_at ?? null });
  })
);

prefsRouter.put(
  '/prefs',
  requireProfile,
  asyncHandler((req, res) => {
    const prefs = req.body?.prefs;
    if (!prefs || typeof prefs !== 'object') throw badRequest('Send a prefs object.');
    run(
      `INSERT INTO prefs (profile_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      [req.profile.id, JSON.stringify(prefs).slice(0, 20000), nowIso()]
    );
    res.json({ ok: true, prefs });
  })
);
