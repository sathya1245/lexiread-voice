# Deploying LexiRead

LexiRead is a **single service**: one Node process serves the JSON API, the
Socket.io channel used by the shared reading room, and the built React client.
That keeps deployment (and the hackathon demo) simple — there is no separate
frontend host, no CORS configuration and no external database to provision.

```
browser ──▶ Node/Express (API + Socket.io) ──▶ SQLite file (profiles, sessions, flagged words)
                   │
                   └──▶ serves client/dist (React build)
```

## 0. What you need in production

| Setting | Why | Suggested value |
| --- | --- | --- |
| `PORT` | Port the service listens on | platform default (Render/Fly inject it) |
| `DATA_DIR` | Where the SQLite database lives | a **mounted disk/volume** (e.g. `/data`) |
| `CLIENT_DIST` | Where the built client lives | `./client/dist` |
| `OCR_LANGS` | Tesseract languages | `eng` (add Indic languages later) |
| `NODE_ENV` | Production build/behaviour | `production` |

Everything else has sensible defaults — see `.env.example`.

> **Important:** on a platform without a persistent disk, SQLite resets on every
> deploy, so profiles and progress disappear. Attach a volume (Render disk, Fly
> volume, or a VM directory) — or swap `server/src/db.js` for Postgres later;
> all database access is isolated in that one module plus
> `server/src/services/reading-data.js`.

## 1. Render (recommended, one-click blueprint)

Fastest path — click, approve, done:

1. <https://render.com/deploy?repo=https://github.com/sathya1245/lexiread-voice>
   (or Render dashboard → **New → Blueprint** → pick the repository).
   `render.yaml` in the repo root does the rest:
   - build: `npm ci && npm run build`
   - start: `node server/src/index.js`
   - health check: `/api/health`
   - `plan: free` and no disk, so **no payment card is required**
   - `DATA_DIR=/tmp/lexiread-data` — writable, but wiped on restart
3. When it finishes, open the service URL. Speech recognition needs HTTPS —
   Render gives you that automatically.

### Free tier: what to expect during a demo

- The instance **sleeps after ~15 minutes idle**. The next request takes ~30–60s
  to wake it, so open the URL in a browser tab before anyone is watching.
- SQLite lives on ephemeral storage: profiles, reading sessions, flagged words
  and the dashboard reset on every restart and deploy.

### Making progress persist

Switch to the always-on setup — `plan: starter` (or higher), a disk, and
`DATA_DIR` pointing at it. The exact block is in the comments at the top of
`render.yaml`. Nothing else changes: `server/src/db.js` creates the directory if
it is missing, and every path is relative to `DATA_DIR`.

## 2. Fly.io

```bash
fly launch --copy-config --name lexiread     # uses fly.toml + Dockerfile
fly volumes create lexiread_data --size 1    # persistent SQLite storage
fly deploy
fly open
```

The `Dockerfile` builds the client inside the image and runs the API from the
same process; `/data` is the mounted volume.

## 3. Docker anywhere (VPS, school server, Raspberry Pi)

```bash
docker build -t lexiread .
docker run -d --name lexiread \
  -p 8787:8787 \
  -v lexiread-data:/data \
  -e DATA_DIR=/data \
  -e NODE_ENV=production \
  lexiread
```

Put a TLS reverse proxy (Caddy, nginx, Cloudflare Tunnel) in front of it: the
Web Speech API only grants microphone access on `https://` or `localhost`.
Caddy is the shortest path:

```
lexiread.example.org {
    reverse_proxy 127.0.0.1:8787
}
```

## 4. Plain Node (no containers)

```bash
npm ci
npm run build
DATA_DIR=./server/data NODE_ENV=production npm start
# or run it under a process manager:
pm2 start server/src/index.js --name lexiread --update-env
```

## 5. Static-only hosting (Netlify / Vercel / GitHub Pages)

Only the client can be hosted statically, because the API and Socket.io server
must run somewhere:

1. Deploy the server (Render/Fly/Docker) and note its URL.
2. Build the client with the API URL rewired — set `LEXIREAD_API` for the Vite
   dev proxy, or add a rewrite from `/api/*` and `/socket.io/*` to that server
   URL in `netlify.toml` / `vercel.json`.
3. `npm --workspace client run build` and publish `client/dist`.

For a hackathon, option 1 or 3 (one service) is by far the least work.

## Post-deploy checklist

- [ ] `GET /api/health` returns `{"ok":true}`
- [ ] Opening the site shows the library screen (client build is being served)
- [ ] Creating a profile works, then sign out and back in
- [ ] Uploading a pasted paragraph creates a document and opens the reader
- [ ] In the reader: **Tap to read** marks words read (no microphone needed)
- [ ] **Ideas** shows key points + glossary
- [ ] **Progress** shows the weekly summary and a practice game
- [ ] On an HTTPS host from a phone: **I read aloud** starts listening
- [ ] **Read together** opens a room and a second device can watch it
- [ ] First OCR run downloads Tesseract language data (~15 MB) — warm it once

## Monitoring and housekeeping

- `GET /api/health` — liveness probe (used by Render/Fly/Docker health checks).
- SQLite grows with documents and events; `server/data/` is safe to back up as
  a file pair (`lexiread.db`, `lexiread.db-wal`). Deleting it resets the demo.
- Handoff codes expire after `HANDOFF_TTL_MS` (6 hours by default) and are
  pruned on the next handoff creation.
- There is no outbound telemetry. The only external request is the optional
  free dictionary API (`dictionaryapi.dev`), which is skipped entirely when it
  is unreachable.
