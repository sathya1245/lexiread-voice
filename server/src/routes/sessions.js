/**
 * Reading session routes: start a session, stream progress, log flags and
 * pace samples, then read the history back for the dashboard or a resume.
 */

import { Router } from 'express';
import { newId } from '../auth.js';
import { get } from '../db.js';
import { asyncHandler, badRequest, intParam, notFound } from '../lib/http.js';
import {
  addEvents,
  addIntervals,
  createSession,
  dropSession,
  eventsForSession,
  getDocument,
  loadSessions,
  updateSession,
} from '../services/reading-data.js';

export const sessionsRouter = Router();

function scopeFrom(req) {
  return {
    profileId: req.profile?.id ?? (req.body?.profileId || req.query.profileId || null),
    deviceId: req.body?.deviceId || req.query.deviceId || req.get('x-device-id') || null,
  };
}

sessionsRouter.post(
  '/',
  asyncHandler((req, res) => {
    const scope = scopeFrom(req);
    const { documentId, mode = 'voice', roomCode = null } = req.body || {};
    if (!documentId) throw badRequest('Which document are we reading?');
    const doc = getDocument(documentId, scope);
    if (!doc) throw notFound('That document is not available.');

    const session = createSession({
      id: newId('s_'),
      profileId: scope.profileId,
      deviceId: scope.deviceId,
      documentId,
      mode,
      roomCode,
    });
    res.status(201).json({ session });
  })
);

const applySessionPatch = asyncHandler((req, res) => {
  {
    const existing = get(`SELECT * FROM sessions WHERE id = ?`, [req.params.id]);
    if (!existing) throw notFound('Session not found.');
    const body = req.body || {};
    const session = updateSession(req.params.id, {
      endedAt: body.ended ? new Date().toISOString() : undefined,
      durationMs: Number.isFinite(body.durationMs) ? Math.round(body.durationMs) : undefined,
      wordsRead: Number.isFinite(body.wordsRead) ? Math.round(body.wordsRead) : undefined,
      cursor: Number.isFinite(body.cursor) ? Math.round(body.cursor) : undefined,
      wpmAvg: Number.isFinite(body.wpmAvg) ? Math.round(body.wpmAvg) : undefined,
      wpmPeak: Number.isFinite(body.wpmPeak) ? Math.round(body.wpmPeak) : undefined,
      mode: body.mode,
    });
    res.json({ session });
  }
});

sessionsRouter.patch('/:id', applySessionPatch);
// Alias for navigator.sendBeacon(), which can only issue POST requests — used
// to save progress when a student closes the tab mid-session.
sessionsRouter.post('/:id/finish', applySessionPatch);

sessionsRouter.post(
  '/:id/events',
  asyncHandler((req, res) => {
    const existing = get(`SELECT * FROM sessions WHERE id = ?`, [req.params.id]);
    if (!existing) throw notFound('Session not found.');
    const { events = [], intervals = [], profileId, deviceId } = req.body || {};
    const scope = { profileId: profileId ?? existing.profile_id, deviceId: deviceId ?? existing.device_id };
    const inserted = addEvents({
      sessionId: existing.id,
      profileId: scope.profileId,
      deviceId: scope.deviceId,
      events: Array.isArray(events) ? events.slice(0, 300) : [],
    });
    const pace = addIntervals({
      sessionId: existing.id,
      profileId: scope.profileId,
      deviceId: scope.deviceId,
      intervals: Array.isArray(intervals) ? intervals : [],
    });
    res.json({ ok: true, inserted, paceSamples: pace });
  })
);

sessionsRouter.get(
  '/',
  asyncHandler((req, res) => {
    const sessions = loadSessions(scopeFrom(req), {
      days: intParam(req.query.days, 120, { min: 1, max: 3650 }),
      limit: intParam(req.query.limit, 40, { min: 1, max: 200 }),
    });
    res.json({ sessions });
  })
);

sessionsRouter.delete(
  '/:id',
  asyncHandler((req, res) => {
    const session = get(`SELECT * FROM sessions WHERE id = ?`, [req.params.id]);
    if (!session) throw notFound('Session not found.');
    dropSession(session.id);
    res.json({ ok: true });
  })
);

sessionsRouter.get(
  '/:id',
  asyncHandler((req, res) => {
    const session = get(`SELECT * FROM sessions WHERE id = ?`, [req.params.id]);
    if (!session) throw notFound('Session not found.');
    const doc = get(`SELECT id, title, kind, text, word_count FROM documents WHERE id = ?`, [session.document_id]);
    res.json({ session, document: doc || null, events: eventsForSession(session.id) });
  })
);
