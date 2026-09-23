/**
 * Lightweight accounts for minors: a display name, a username and a short PIN.
 * No email, no birth date, nothing to leak. PINs are hashed with scrypt and
 * sessions are opaque random bearer tokens kept server-side, so a lost device
 * can simply have its token dropped from the `tokens` table.
 */

import crypto from 'node:crypto';
import { all, get, nowIso, run } from './db.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(secret), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export function verifySecret(secret, stored) {
  if (!stored) return false;
  const [, salt, hex] = String(stored).split('$');
  if (!salt || !hex) return false;
  const key = crypto.scryptSync(String(secret), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

export const newId = (prefix = '') => `${prefix}${crypto.randomBytes(9).toString('hex')}`;

export function createProfile({ username, displayName, pin, role = 'student', deviceId = null }) {
  const id = newId('u_');
  run(
    `INSERT INTO profiles (id, username, display_name, pin_hash, role, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, String(username).toLowerCase().trim(), displayName?.trim() || username, hashSecret(pin), role, deviceId, nowIso()]
  );
  return getProfile(id);
}

export function getProfile(id) {
  return get(`SELECT id, username, display_name, role, device_id, created_at FROM profiles WHERE id = ?`, [id]);
}

export function findProfileByUsername(username) {
  return get(`SELECT * FROM profiles WHERE username = ?`, [String(username || '').toLowerCase().trim()]);
}

export function createToken(profileId) {
  const token = crypto.randomBytes(24).toString('hex');
  run(`INSERT INTO tokens (token, profile_id, created_at) VALUES (?, ?, ?)`, [token, profileId, nowIso()]);
  return token;
}

export function resolveToken(token) {
  if (!token) return null;
  const row = get(`SELECT profile_id FROM tokens WHERE token = ?`, [token]);
  if (!row) return null;
  run(`UPDATE tokens SET last_seen = ? WHERE token = ?`, [nowIso(), token]);
  return getProfile(row.profile_id);
}

export function dropToken(token) {
  if (token) run(`DELETE FROM tokens WHERE token = ?`, [token]);
}

export function profilesForDevice(deviceId) {
  if (!deviceId) return [];
  return all(
    `SELECT id, username, display_name, role FROM profiles WHERE device_id = ? ORDER BY created_at ASC`,
    [deviceId]
  );
}

export function publicProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? row.displayName,
    role: row.role,
    deviceId: row.device_id ?? row.deviceId ?? null,
  };
}

/** Express middleware: attaches req.profile when a valid bearer token is sent. */
export function attachProfile(req, _res, next) {
  const header = req.get?.('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.token = token;
  req.profile = token ? resolveToken(token) : null;
  next();
}

export function requireProfile(req, res, next) {
  if (!req.profile) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}
