/**
 * Dashboard routes: passive reading-pattern insights, the plain-language
 * weekly summary, and the personalised practice mini-game.
 */

import { Router } from 'express';
import { asyncHandler, intParam } from '../lib/http.js';
import { defineWord } from '../modules/comprehension/define.js';
import { generatePracticeGame } from '../modules/games/generate.js';
import { analyzeReadingPatterns } from '../modules/nlp/analyze.js';
import { buildWeeklySummary } from '../modules/reports/weekly.js';
import { loadEvents, loadIntervals, loadSessions } from '../services/reading-data.js';

export const insightsRouter = Router();

function scopeFrom(req) {
  return {
    profileId: req.profile?.id ?? (req.body?.profileId || req.query.profileId || null),
    deviceId: req.body?.deviceId || req.query.deviceId || req.get('x-device-id') || null,
  };
}

function gather(req, days) {
  const scope = scopeFrom(req);
  const sessions = loadSessions(scope, { days, limit: 200 });
  const events = loadEvents(scope, { days });
  const intervals = loadIntervals(scope, { days }).map((r) => r.ms);
  const name = req.profile?.display_name || req.query.name || 'your reader';
  return { scope, sessions, events, intervals, name };
}

function dashboardStats(sessions, events) {
  const durationMs = sessions.reduce((acc, s) => acc + (s.duration_ms || 0), 0);
  const wordsRead = sessions.reduce((acc, s) => acc + (s.words_read || 0), 0);
  const paces = sessions.map((s) => s.wpm_avg).filter((n) => Number.isFinite(n) && n > 0);
  const byDay = new Map();
  for (const s of sessions) {
    const day = String(s.started_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const flaggedWords = new Map();
  for (const e of events) flaggedWords.set(e.word.toLowerCase(), (flaggedWords.get(e.word.toLowerCase()) || 0) + 1);
  return {
    sessions: sessions.length,
    minutes: Math.round(durationMs / 60000),
    wordsRead,
    avgWpm: paces.length ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) : null,
    bestWpm: paces.length ? Math.round(Math.max(...paces)) : null,
    daysRead: byDay.size,
    activeDays: [...byDay.entries()].sort().slice(-14).map(([day, count]) => ({ day, sessions: count })),
    flaggedEventCount: events.length,
    distinctFlaggedWords: flaggedWords.size,
  };
}

insightsRouter.get(
  '/insights',
  asyncHandler((req, res) => {
    const days = intParam(req.query.days, 90, { min: 1, max: 3650 });
    const { sessions, events, intervals, name } = gather(req, days);
    const insights = analyzeReadingPatterns({ sessions, events, intervals, name });
    res.json({
      ...insights,
      stats: dashboardStats(sessions, events),
      recentSessions: sessions.slice(0, 20).map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode,
        startedAt: s.started_at,
        durationMs: s.duration_ms,
        wordsRead: s.words_read,
        wpmAvg: s.wpm_avg,
        cursor: s.cursor,
      })),
    });
  })
);

insightsRouter.get(
  '/summary/weekly',
  asyncHandler((req, res) => {
    const days = intParam(req.query.days, 7, { min: 1, max: 90 });
    const { sessions, events, intervals, name } = gather(req, days);
    const insights = analyzeReadingPatterns({ sessions, events, intervals, name });
    const summary = buildWeeklySummary({ name, sessions, events, insights, days });
    res.json({ summary, stats: dashboardStats(sessions, events) });
  })
);

insightsRouter.get(
  '/games/from-errors',
  asyncHandler(async (req, res) => {
    const days = intParam(req.query.days, 120, { min: 1, max: 3650 });
    const { sessions, events, intervals, name } = gather(req, days);
    const insights = analyzeReadingPatterns({ sessions, events, intervals, name });
    const practiceWords = insights.practiceWords.slice(0, 6);

    const definitions = new Map();
    for (const w of practiceWords.slice(0, 4)) {
      try {
        const def = await defineWord(w.word);
        definitions.set(w.word.toLowerCase(), def);
      } catch {
        /* offline: heuristic hints still work */
      }
    }

    const game = generatePracticeGame({ practiceWords, definitions });
    res.json({ game, practiceWords, disclaimer: insights.disclaimer });
  })
);
