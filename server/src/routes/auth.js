/**
 * Accounts for minors: display name + username + short PIN.
 * Multiple profiles per device are supported for family/classroom sharing.
 */

import { Router } from 'express';
import {
  createProfile,
  createToken,
  dropToken,
  findProfileByUsername,
  profilesForDevice,
  publicProfile,
  verifySecret,
} from '../auth.js';
import { asyncHandler, badRequest } from '../lib/http.js';

export const authRouter = Router();

const cleanUsername = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

authRouter.post(
  '/signup',
  asyncHandler((req, res) => {
    const { displayName, pin, role, deviceId } = req.body || {};
    const username = cleanUsername(req.body?.username);
    if (!username || username.length < 3) throw badRequest('Pick a username with at least 3 letters or numbers.');
    if (!/^\d{4,6}$/.test(String(pin || ''))) throw badRequest('Choose a 4 to 6 digit PIN.');
    if (findProfileByUsername(username)) throw badRequest('That username is already taken on this device.');

    const profile = createProfile({
      username,
      displayName: displayName || username,
      pin,
      role: ['student', 'helper'].includes(role) ? role : 'student',
      deviceId: deviceId || null,
    });
    const token = createToken(profile.id);
    res.status(201).json({ token, profile: publicProfile(profile) });
  })
);

authRouter.post(
  '/login',
  asyncHandler((req, res) => {
    const username = cleanUsername(req.body?.username);
    const row = findProfileByUsername(username);
    if (!row || !verifySecret(req.body?.pin, row.pin_hash)) {
      return res.status(401).json({ error: 'That username and PIN do not match.' });
    }
    const token = createToken(row.id);
    res.json({ token, profile: publicProfile(row) });
  })
);

authRouter.post(
  '/logout',
  asyncHandler((req, res) => {
    dropToken(req.token);
    res.json({ ok: true });
  })
);

authRouter.get('/me', (req, res) => {
  if (!req.profile) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ profile: publicProfile(req.profile) });
});

/** Profiles previously used on this device (no secrets: name + username only). */
authRouter.get('/profiles', (req, res) => {
  res.json({ profiles: profilesForDevice(req.query.deviceId).map(publicProfile) });
});

