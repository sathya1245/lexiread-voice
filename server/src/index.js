/**
 * LexiRead server.
 *
 * One process serves three things:
 *   1. the JSON API under /api,
 *   2. the Socket.io channel used by the Shared Reading Room,
 *   3. the built React client (when `npm run build` has produced client/dist),
 *      so the whole app can be deployed as a single Node service.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { attachProfile } from './auth.js';
import { config } from './config.js';
import { initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { contentRouter } from './routes/content.js';
import { handoffRouter, prefsRouter } from './routes/handoff.js';
import { insightsRouter } from './routes/insights.js';
import { sessionsRouter } from './routes/sessions.js';
import { supportRouter } from './routes/support.js';
import { registerRoomHandlers } from './sockets/room.js';

initDb();

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','), credentials: false }));
app.use(express.json({ limit: '4mb' }));
app.use(attachProfile);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'lexiread', time: new Date().toISOString() });
});

app.get('/api/profile', (req, res) => {
  res.json({
    profile: req.profile
      ? { id: req.profile.id, username: req.profile.username, displayName: req.profile.display_name, role: req.profile.role }
      : null,
    anonymousAllowed: config.allowAnonymous,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/content', contentRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', supportRouter);
app.use('/api', insightsRouter);
app.use('/api', handoffRouter);
app.use('/api', prefsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

// Static client (production build). In development Vite serves the client.
const indexHtml = path.join(config.clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[lexiread] error', err);
  res.status(status).json({
    error: err.message || 'Something went wrong.',
    ...(err.extra ? { extra: err.extra } : {}),
  });
});

export const server = http.createServer(app);
export const io = new SocketServer(server, {
  cors: { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') },
  path: '/socket.io',
});
registerRoomHandlers(io);

if (process.env.NO_LISTEN !== '1') {
  server.listen(config.port, config.host, () => {
    console.log(`LexiRead API listening on http://localhost:${config.port}`);
    if (!fs.existsSync(indexHtml)) {
      console.log('Client build not found — run `npm run build` (or `npm run dev` for the Vite dev server).');
    }
  });
}

export default app;
