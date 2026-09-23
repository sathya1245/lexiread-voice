/**
 * Shared Reading Room.
 *
 * A student's device publishes its live reading position; a helper (teacher or
 * parent) opens the same room code and watches in real time. The helper can
 * send a short encouragement note or hint, which the student sees as a gentle
 * pop-up — never a notification that interrupts the reading flow.
 *
 * Rooms live in memory: they are ephemeral by design and hold no history
 * beyond the last few nudges. Only the current word, sentence and pace are
 * shared, so a helper sees "where the reader is", not a recording.
 */

import { all, nowIso, run } from '../db.js';

const MAX_NUDGES = 20;
const rooms = new Map();

function roomFor(code) {
  const key = String(code || '').toUpperCase().trim();
  if (!key) return null;
  let room = rooms.get(key);
  if (!room) {
    room = {
      code: key,
      state: null,
      nudges: [],
      students: new Map(),
      helpers: new Map(),
      updatedAt: Date.now(),
    };
    rooms.set(key, room);
  }
  return room;
}

function recentNudgesFromDb(code) {
  try {
    return all(
      `SELECT from_name, text, created_at FROM nudges WHERE room_code = ? ORDER BY id DESC LIMIT ?`,
      [code, MAX_NUDGES]
    )
      .map((n) => ({ from: n.from_name, text: n.text, at: n.created_at }))
      .reverse();
  } catch {
    return [];
  }
}

function presence(room) {
  return {
    students: [...room.students.values()],
    helpers: [...room.helpers.values()],
  };
}

function roomSummary(room) {
  return {
    roomCode: room.code,
    state: room.state,
    nudges: room.nudges,
    presence: presence(room),
  };
}

function summariseState(payload = {}) {
  return {
    title: payload.title ? String(payload.title).slice(0, 120) : null,
    mode: payload.mode === 'narrated' ? 'narrated' : 'voice',
    cursor: Number.isFinite(payload.cursor) ? payload.cursor : 0,
    totalWords: Number.isFinite(payload.totalWords) ? payload.totalWords : null,
    word: payload.word ? String(payload.word).slice(0, 60) : null,
    sentence: payload.sentence ? String(payload.sentence).slice(0, 240) : null,
    nextWords: Array.isArray(payload.nextWords) ? payload.nextWords.slice(0, 12).map(String) : [],
    stuck: Boolean(payload.stuck),
    stuckFor: Number.isFinite(payload.stuckFor) ? Math.round(payload.stuckFor) : 0,
    wpm: Number.isFinite(payload.wpm) ? Math.round(payload.wpm) : null,
    flagged: Array.isArray(payload.flagged) ? payload.flagged.slice(-20).map(String) : [],
    percent: Number.isFinite(payload.percent) ? Math.round(payload.percent) : null,
    at: Date.now(),
  };
}

export function registerRoomHandlers(io) {
  io.on('connection', (socket) => {
    let joined = null;

    socket.on('room:join', (payload = {}, ack) => {
      const room = roomFor(payload.roomCode);
      if (!room) {
        if (ack) ack({ ok: false, error: 'A room code is required.' });
        return;
      }
      const role = payload.role === 'helper' ? 'helper' : 'student';
      const name = String(payload.name || (role === 'helper' ? 'Helper' : 'Reader')).slice(0, 40);
      const member = { id: socket.id, name, role, joinedAt: Date.now() };

      joined = { code: room.code, role };
      room[role === 'helper' ? 'helpers' : 'students'].set(socket.id, member);
      room.updatedAt = Date.now();
      socket.join(room.code);

      if (!room.nudges.length) room.nudges = recentNudgesFromDb(room.code);

      const ackPayload = { ok: true, ...roomSummary(room), you: member };
      if (ack) ack(ackPayload);
      socket.to(room.code).emit('room:presence', presence(room));
    });

    socket.on('room:state', (payload = {}) => {
      if (!joined) return;
      const room = rooms.get(joined.code);
      if (!room || joined.role !== 'student') return;
      room.state = summariseState(payload);
      room.updatedAt = Date.now();
      socket.to(room.code).emit('room:update', room.state);
    });

    socket.on('room:nudge', (payload = {}, ack) => {
      if (!joined) {
        if (ack) ack({ ok: false, error: 'Join a room first.' });
        return;
      }
      const room = rooms.get(joined.code);
      if (!room) return;
      const text = String(payload.text || '').trim().slice(0, 200);
      if (!text) {
        if (ack) ack({ ok: false, error: 'Write a short note first.' });
        return;
      }
      const member = room[joined.role === 'helper' ? 'helpers' : 'students'].get(socket.id);
      const nudge = { from: member?.name || payload.from || 'Helper', text, at: nowIso(), kind: payload.kind || 'encourage' };
      room.nudges = [...room.nudges, nudge].slice(-MAX_NUDGES);
      room.updatedAt = Date.now();
      try {
        run(`INSERT INTO nudges (room_code, from_name, text, created_at) VALUES (?, ?, ?, ?)`, [
          room.code,
          nudge.from,
          text,
          nudge.at,
        ]);
      } catch {
        /* rooms must keep working even if the note cannot be stored */
      }
      io.to(room.code).emit('room:nudge', nudge);
      if (ack) ack({ ok: true, nudge });
    });

    socket.on('room:leave', () => {
      leave();
    });

    socket.on('disconnect', () => {
      leave();
    });

    function leave() {
      if (!joined) return;
      const room = rooms.get(joined.code);
      if (room) {
        room.students.delete(socket.id);
        room.helpers.delete(socket.id);
        socket.to(room.code).emit('room:presence', presence(room));
        if (!room.students.size && !room.helpers.size && Date.now() - room.updatedAt > 1000 * 60 * 30) {
          rooms.delete(room.code);
        }
      }
      joined = null;
    }
  });
}

export function roomCount() {
  return rooms.size;
}
