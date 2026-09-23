/**
 * End-to-end API test.
 *
 * Boots the real server (its own SQLite file in a temp directory, its own
 * port), then walks the whole student journey: sign up, save preferences,
 * upload content, run a session with flags, read the dashboard, weekly summary
 * and practice game, hand off to another device, and finally check the shared
 * reading room over a real Socket.io connection.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { io as ioClient } from 'socket.io-client';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, '..', 'src', 'index.js');
const PORT = 8791 + Math.floor(Math.random() * 40);
const BASE = `http://127.0.0.1:${PORT}`;

let child;
let dataDir;

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start in time');
}

const api = async (path2, { method = 'GET', body, token, deviceId, raw } = {}) => {
  const headers = {};
  if (body && !raw) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (deviceId) headers['x-device-id'] = deviceId;
  const res = await fetch(`${BASE}${path2}`, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
};

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lexiread-test-'));
  child = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      CORS_ORIGIN: '*',
      DICTIONARY_TIMEOUT_MS: '4000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.env.DEBUG_API && console.error(String(d)));
  await waitForHealth();
});

test.after(async () => {
  child?.kill();
  // Give SQLite a moment to release its WAL files (Windows keeps them locked).
  await new Promise((r) => setTimeout(r, 300));
  try {
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* temp dir cleanup is best effort */
  }
});

const DEVICE = 'device-test-1';

test('health and anonymous profile', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);

  const me = await api('/api/profile');
  assert.equal(me.body.profile, null);
  assert.equal(me.body.anonymousAllowed, true);
});

test('signup, login and preferences round-trip', async () => {
  const signup = await api('/api/auth/signup', {
    method: 'POST',
    body: { username: 'aditi', displayName: 'Aditi', pin: '1234', deviceId: DEVICE },
  });
  assert.equal(signup.status, 201);
  const token = signup.body.token;
  assert.ok(token);
  assert.equal(signup.body.profile.displayName, 'Aditi');

  const dup = await api('/api/auth/signup', {
    method: 'POST',
    body: { username: 'aditi', displayName: 'Aditi 2', pin: '1234' },
  });
  assert.equal(dup.status, 400);

  const badLogin = await api('/api/auth/login', { method: 'POST', body: { username: 'aditi', pin: '9999' } });
  assert.equal(badLogin.status, 401);

  const login = await api('/api/auth/login', { method: 'POST', body: { username: 'aditi', pin: '1234' } });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const profiles = await api(`/api/auth/profiles?deviceId=${DEVICE}`);
  assert.equal(profiles.body.profiles.length, 1);
  assert.equal(profiles.body.profiles[0].username, 'aditi');

  const prefs = {
    font: 'opendyslexic',
    fontSize: 22,
    lineHeight: 1.8,
    letterSpacing: 0.06,
    theme: 'cream',
    bionic: true,
    speechRate: 0.9,
    haptics: true,
  };
  const saved = await api('/api/prefs', { method: 'PUT', token, body: { prefs } });
  assert.equal(saved.status, 200);
  const read = await api('/api/prefs', { token });
  assert.deepEqual(read.body.prefs, prefs);

  const anon = await api('/api/prefs', { method: 'PUT', body: { prefs } });
  assert.equal(anon.status, 401, 'anonymous users keep preferences on the device');

  return token;
});

const ARTICLE = `Photosynthesis is how green plants turn sunlight into food. Chlorophyll in the leaves catches the light.
Carbon dioxide comes in through tiny holes and water travels up from the roots.
The plant stores the energy as glucose and releases oxygen into the atmosphere.
Without photosynthesis there would be no food chain and no oxygen for animals.`;

test('paste content, extract, summarise and simplify it', async () => {
  const created = await api('/api/content', {
    method: 'POST',
    body: { text: ARTICLE, title: 'How plants eat', deviceId: DEVICE },
  });
  assert.equal(created.status, 201);
  const doc = created.body.document;
  assert.ok(doc.id.startsWith('d_'));
  assert.equal(doc.title, 'How plants eat');
  assert.ok(doc.wordCount > 50);

  const library = await api(`/api/content?deviceId=${DEVICE}`);
  assert.equal(library.body.documents.length, 1);
  assert.equal(library.body.documents[0].title, 'How plants eat');

  const full = await api(`/api/content/${doc.id}?deviceId=${DEVICE}`);
  assert.equal(full.status, 200);
  assert.match(full.body.document.text, /Photosynthesis/);

  const otherDevice = await api(`/api/content/${doc.id}?deviceId=nope`);
  assert.equal(otherDevice.status, 404, 'documents are scoped to their device/profile');

  const summary = await api('/api/summarize', {
    method: 'POST',
    body: { documentId: doc.id, deviceId: DEVICE },
  });
  assert.equal(summary.status, 200);
  assert.ok(summary.body.summary.keyPoints.length >= 3);
  assert.ok(summary.body.glossary.length >= 1, 'technical terms are listed');
  assert.ok(summary.body.glossary.every((g) => g.explanations && g.explanations['5']));

  const simplified = await api('/api/simplify', {
    method: 'POST',
    body: { text: summary.body.summary.keyPoints[0].text, level: 5 },
  });
  assert.equal(simplified.status, 200);
  assert.ok(simplified.body.result.text.length > 0);

  const definition = await api('/api/dictionary/photosynthesis');
  assert.equal(definition.status, 200);
  assert.equal(definition.body.found, true);
  assert.equal(definition.body.source, 'offline');
  assert.match(definition.body.explanations['5'], /^Think of it like this:/);
  assert.ok(definition.body.syllables.length >= 4);

  const writing = await api('/api/writing/check', {
    method: 'POST',
    body: { text: 'i think teh plant need water becuase it grow.' },
  });
  assert.equal(writing.status, 200);
  assert.ok(writing.body.issues.some((i) => i.type === 'spelling'));
  assert.ok(writing.body.issues.every((i) => i.severity !== 'error'));

  return doc.id;
});

test('reading session captures flags, pace and dashboard insights', async () => {
  const docs = await api(`/api/content?deviceId=${DEVICE}`);
  const documentId = docs.body.documents[0].id;

  const started = await api('/api/sessions', {
    method: 'POST',
    body: { documentId, mode: 'voice', deviceId: DEVICE, roomCode: 'TEST01' },
  });
  assert.equal(started.status, 201);
  const sessionId = started.body.session.id;

  const events = [
    { type: 'close', word: 'photosynthesis', wordIndex: 0, heard: 'fotosinthesis', atMs: 1200 },
    { type: 'difficult', word: 'chlorophyll', wordIndex: 5, atMs: 4200 },
    { type: 'skipped', word: 'atmosphere', wordIndex: 40, confidence: 'high', atMs: 9000 },
    { type: 'help', word: 'glucose', wordIndex: 30, atMs: 7000 },
  ];
  const logged = await api(`/api/sessions/${sessionId}/events`, {
    method: 'POST',
    body: { events, intervals: [800, 900, 2400, 700, 1100, 3200], deviceId: DEVICE },
  });
  assert.equal(logged.body.inserted, 4);
  assert.equal(logged.body.paceSamples, 6);

  const patched = await api(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { cursor: 42, wordsRead: 42, durationMs: 600000, wpmAvg: 64, wpmPeak: 90, ended: true },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.session.words_read, 42);

  const resume = await api(`/api/sessions/${sessionId}`);
  assert.equal(resume.body.events.length, 4);
  assert.equal(resume.body.document.title, 'How plants eat');

  const insights = await api(`/api/insights?deviceId=${DEVICE}&name=Aditi`);
  assert.equal(insights.status, 200);
  assert.equal(insights.body.stats.sessions, 1);
  assert.equal(insights.body.stats.wordsRead, 42);
  // Words the student marked themselves as tricky outrank recogniser wobbles.
  assert.deepEqual(
    insights.body.practiceWords.slice(0, 2).map((w) => w.word).sort(),
    ['chlorophyll', 'photosynthesis']
  );
  assert.equal(insights.body.practiceWords[0].word, 'chlorophyll');
  assert.match(insights.body.disclaimer, /not a diagnosis/i);
  assert.ok(insights.body.insights.length >= 1);

  const weekly = await api(`/api/summary/weekly?deviceId=${DEVICE}&name=Aditi`);
  assert.equal(weekly.status, 200);
  assert.equal(weekly.body.summary.empty, false);
  assert.match(weekly.body.summary.paragraphs.join(' '), /photosynthesis/);

  const game = await api(`/api/games/from-errors?deviceId=${DEVICE}`);
  assert.equal(game.status, 200);
  assert.equal(game.body.game.empty, false);
  assert.ok(game.body.game.words.some((w) => w.word === 'photosynthesis'));
  assert.ok(game.body.game.rounds.length >= 1);
});

test('QR handoff survives a round trip and expires cleanly', async () => {
  const payload = {
    documentId: 'd_demo',
    title: 'How plants eat',
    cursor: 42,
    prefs: { fontSize: 22, font: 'lexend', theme: 'cream' },
    mode: 'voice',
  };
  const created = await api('/api/handoff', { method: 'POST', body: { payload } });
  assert.equal(created.status, 201);
  const { code } = created.body;
  assert.match(code, /^[A-Z2-9]{6}$/);

  const fetched = await api(`/api/handoff/${code}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.payload.cursor, 42);
  assert.deepEqual(fetched.body.payload.prefs, payload.prefs);

  const missing = await api('/api/handoff/ZZZZZZ');
  assert.equal(missing.status, 404);
});

test('shared reading room syncs live state and encouragement notes', async () => {
  const roomCode = `ROOM${Math.floor(Math.random() * 90 + 10)}`;
  const student = ioClient(BASE, { transports: ['websocket'], forceNew: true });
  const helper = ioClient(BASE, { transports: ['websocket'], forceNew: true });

  const once = (socket, event, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeout);
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  try {
    await Promise.all([once(student, 'connect'), once(helper, 'connect')]);

    const studentJoin = await new Promise((resolve) =>
      student.emit('room:join', { roomCode, role: 'student', name: 'Aditi' }, resolve)
    );
    assert.equal(studentJoin.ok, true);
    assert.equal(studentJoin.presence.students.length, 1);

    const helperJoin = await new Promise((resolve) =>
      helper.emit('room:join', { roomCode, role: 'helper', name: 'Ms Rao' }, resolve)
    );
    assert.equal(helperJoin.ok, true);

    const update = once(helper, 'room:update');
    student.emit('room:state', {
      title: 'How plants eat',
      mode: 'voice',
      cursor: 12,
      totalWords: 60,
      word: 'chlorophyll',
      sentence: 'Chlorophyll in the leaves catches the light.',
      stuck: true,
      stuckFor: 4200,
      wpm: 58,
      flagged: ['photosynthesis'],
      percent: 20,
    });
    const state = await update;
    assert.equal(state.word, 'chlorophyll');
    assert.equal(state.stuck, true);
    assert.equal(state.wpm, 58);
    assert.match(state.sentence, /chlorophyll/i);

    const nudgeAtStudent = once(student, 'room:nudge');
    const ack = await new Promise((resolve) =>
      helper.emit('room:nudge', { roomCode, text: 'You are doing great — try slow and steady.', kind: 'encourage' }, resolve)
    );
    assert.equal(ack.ok, true);
    const nudge = await nudgeAtStudent;
    assert.equal(nudge.text, 'You are doing great — try slow and steady.');
    assert.equal(nudge.from, 'Ms Rao');

    const lateHelper = ioClient(BASE, { transports: ['websocket'], forceNew: true });
    await once(lateHelper, 'connect');
    const lateJoin = await new Promise((resolve) =>
      lateHelper.emit('room:join', { roomCode, role: 'helper', name: 'Dad' }, resolve)
    );
    assert.ok(lateJoin.nudges.length >= 1, 'a helper joining later sees recent notes');
    assert.equal(lateJoin.state.word, 'chlorophyll', 'and the live position');
    lateHelper.close();
  } finally {
    student.close();
    helper.close();
  }
});

test('unknown routes and validation errors return friendly JSON', async () => {
  const unknown = await api('/api/nope');
  assert.equal(unknown.status, 404);
  assert.match(unknown.body.error, /Unknown API route/);

  const empty = await api('/api/content', { method: 'POST', body: { deviceId: DEVICE } });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /Add a file or paste some text/);

  const badSession = await api('/api/sessions', { method: 'POST', body: { deviceId: DEVICE } });
  assert.equal(badSession.status, 400);
});
