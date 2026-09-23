# LexiRead

**An assistive learning platform for students with dyslexia.** Bring any study
content — a PDF, a photo of the page, or pasted text — and LexiRead turns it
into a dyslexia-friendly reading, listening and writing experience. In the
flagship mode the app doesn't read *to* the student: it **listens to the student
read**, and the highlight follows *their* voice, at *their* pace.

```
Upload / paste ──▶ extraction (PDF · OCR) ──▶ reading view ──▶ voice-following guided reading
                                                    │                    │
                                                    │                    ├─ soft flags → practice words
                                                    ▼                    ├─ live pace (wpm) + haptics
                                    Ideas · Simplify · Write             └─ shared reading room (live)
```

Everything runs on browser-native speech APIs and a free dictionary. No paid
cloud services, no audio ever leaves the device.

---

## Table of contents

- [Quick start](#quick-start)
- [The core idea: voice-following guided reading](#the-core-idea-voice-following-guided-reading)
- [Feature tour](#feature-tour)
- [Hackathon differentiators](#hackathon-differentiators)
- [How it is built](#how-it-is-built)
- [API reference](#api-reference)
- [Testing](#testing)
- [Accessibility](#accessibility)
- [Privacy for minors](#privacy-for-minors)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Quick start

```bash
# Node 20.11+ (Node 22/24 recommended — the server uses the built-in node:sqlite)
npm install
npm run dev          # API on :8787 + Vite dev server on :5173
```

Then open <http://localhost:5173>. For the production-style single service:

```bash
npm run build        # builds client/dist
npm start            # serves API + client on http://localhost:8787
```

Try it in 20 seconds: **Library → “How plants make their own food” → 👆 Tap to
read**, then tap/press Enter through the first paragraph. The dashboard fills up
with practice words, patterns and a game built from the words you tapped.

> **Microphone modes need Chrome, Edge or Android Chrome**, and (except on
> `localhost`) an HTTPS URL — that is a browser rule, not an app limit. On any
> device without speech recognition, *Tap to read* exercises exactly the same
> tracking, flagging and progress pipeline, so nothing is lost.

---

## The core idea: voice-following guided reading

Most reading apps read *to* a child. LexiRead's flagship mode flips that: the
student reads out loud, `SpeechRecognition` streams messy words back, and the
app has to work out **which word of the document was just read**.

That is a sequence-alignment problem, not a look-up problem. A hand-rolled
"find the next matching word" approach falls apart the moment a recogniser
returns `fotosinthesis` for *photosynthesis*, drops a word, or repeats one.
So the matcher is a proper anchored **dynamic-programming alignment**
(`shared/aligner.js`, ~200 lines, zero dependencies) between the tail of the
transcript and a window of upcoming document words:

- **Length-aware thresholds** — `cat` must match almost exactly, while
  `photosynthesis` is allowed to be 40 % different.
- **Phonetic collapse** — `soundKey()` maps *photo/foto*, *knight/nite*,
  *back/bak* to the same key, so mispronunciations still track.
- **Free trailing words** — reading half a paragraph still registers progress.
- **Confidence-tagged misses** — a skipped short function word is reported as
  *low confidence* rather than as a reading error, because a dropped recogniser
  token is indistinguishable from a skipped word. Emphasis is on practice, not
  on scoring.
- **Unmatched spoken words are recycled**, so a stumble or a repeated word never
  derails the cursor.

```bash
node --test shared/test/aligner.test.js   # 17 cases: skips, stumbles, mispronunciations, jumps
```

On top of the aligner: a rolling WPM tracker, stall detection (→ a quiet “tap to
hear this word” offer), inter-word interval variance (a fluency signal), and
haptic feedback for hard words read correctly.

See [docs/VOICE-FOLLOWING.md](docs/VOICE-FOLLOWING.md) for the full walkthrough.

---

## Feature tour

### 1. Content upload & extraction
PDF, photo (PNG/JPEG/WebP…), text file, or pasted text. PDFs are read from
their text layer with **pdf.js**; pages with no text layer are rendered with
`@napi-rs/canvas` and OCR'd with **tesseract.js**. Extraction is a module per
format (`server/src/modules/extract/`) so a new format is one small file.

### 2. Dyslexia-friendly reading view
- **Fonts**: Lexend (default), OpenDyslexic, plain Verdana — bundled locally, no
  network fetch.
- **Spacing**: text size, line height, letter spacing, word spacing, line length.
- **Colour presets**: cream, soft blue, soft yellow, mint, lavender, grey and a
  night theme, plus an adjustable **Irlen-style overlay tint** on top of
  everything.
- **Bionic reading**: bolds the first letters of every word.
- Every setting is applied through CSS variables and saved per profile.

### 3. Voice-following guided reading (flagship)
- Reads the student's voice and highlights each word as *they* read it.
- Mispronounced words get a soft dotted underline; missed words a dashed one.
  Never a red X, never a harsh sound, never an interruption.
- Stalls after ~4 s (configurable) offer “tap to hear this word” via TTS.
- Live **words-per-minute** meter, words-read count and progress bar.
- One-tap switch to **Listen to it** (TTS) or **Tap to read** without losing the
  place, the flags or the session.

### 4. Text-to-speech narrated mode
Play/pause/stop, “start from here”, speed and pitch, voice selection, and
word-sync highlighting using `onboundary` with a timing-estimate fallback for
browsers that never fire it.

### 5. Comprehension support
- **Tap any word** for a meaning, syllables, the tricky sounds inside it, and a
  button to hear it in beats.
- **Key points**: an offline extractive summariser (frequency + position +
  shape scoring) that only ever returns sentences from the student's own text.
- **Glossary**: technical terms, names and acronyms, ranked and explained from
  the built-in school vocabulary, the free dictionary API (parallel, with a
  deadline and a circuit breaker), or morphology.
- **Reading difficulty**: “Easy to read on your own” → “Hard — read it with
  someone or use Listen mode”.

### 6. Writing assistance
Type or dictate (speech-to-text). Checks are plain-spoken and graded
*worth fixing / have a look / idea*: known spelling slips, doubled words,
missing capitals, over-long sentences, sound-alike words, spacing, shouting.
Every suggestion is one tap to apply — nothing is changed automatically. “Read
back my writing” uses the same speech engine.

### 7. Profiles & preferences
A display name, a username and a 4–6 digit PIN. No email, no birth date.
Multiple profiles per device for family or classroom use, each with their own
fonts, colours, spacing, voice and practice history. Anonymous use works too —
preferences then live on the device.

### 8. Progress dashboard
Sessions, time read, words read, average and best pace, and words to practise —
led by an auto-generated **plain-language weekly summary**:

> *“This week Aditi finished 4 reading sessions — about 31 minutes of reading,
> covering 1,204 words. Reading pace improved: 58 to 74 words per minute across
> the week. Aditi paused or needed help most on “photosynthesis”, “chlorophyll”
> and “atmosphere” — mostly words with the "ph" sound and long, multi-syllable
> words. Five words to practise together: …”*

---

## Hackathon differentiators

| # | Feature | Where it lives |
| --- | --- | --- |
| 9 | **“Explain Like I'm ___” complexity slider** (age 5 / 8 / 12 / adult) on every explanation, summary and glossary entry — a deterministic rule-based rewriter (word swaps, clause trimming, padding removal), instant and offline | `server/src/modules/comprehension/simplify.js`, `client/.../ComplexitySlider.jsx` |
| 10 | **Passive reading-pattern insights** — sound families (`ph`/`gh`, `-tion`, blends), multi-syllable struggles, b/d/p/q letter-shape risk, words that recur across sessions, pace variance — all phrased as *practice*, with a “not a diagnosis” disclaimer on every payload | `server/src/modules/nlp/analyze.js` |
| 11 | **Targeted mini-game from real errors** — three rounds built only from the student's own flagged words: match word↔meaning, tap the syllable beats, find the word with the tricky sound. Deterministic, keyboard- and screen-reader-friendly | `server/src/modules/games/generate.js`, `client/.../PracticeGame.jsx` |
| 12 | **Haptic phonics feedback** — distinct vibration patterns for a word read correctly vs. a hard word (blend/digraph/3+ syllables) read correctly; rewarded, never punitive | `client/src/lib/haptics.js` |
| 13 | **Shared reading room** — Socket.io room where a teacher or parent sees the live word, sentence, stall time and pace, and can send a note that appears gently in the reader | `server/src/sockets/room.js`, `client/src/features/room/` |
| 14 | **QR handoff** — a QR code (or 6-character code) that moves the exact session — document, position, mode and preferences — to another device with no login; the text travels with the code | `server/src/routes/handoff.js`, `client/src/features/handoff/ResumePage.jsx` |

---

## How it is built

```
lexiread/
├── shared/                 @lexiread/core — pure logic shared by client and server, unit-tested
│   ├── phonics.js          syllables, blends/digraphs, sound keys, difficulty, reversal risk
│   ├── tokenize.js         words / sentences / paragraphs with stable indexes (keeps original text)
│   └── aligner.js          voice-following DP alignment, pace tracker, stall detection
├── server/                 Express + Socket.io + node:sqlite
│   └── src/
│       ├── index.js        API + socket server + serves client/dist
│       ├── db.js           SQLite schema (profiles, prefs, documents, sessions, events, handoffs)
│       ├── auth.js         PIN hashing (scrypt), bearer tokens, profile scoping
│       ├── data/           offline school vocabulary, simplifications, spellings, homophones
│       ├── modules/
│       │   ├── extract/    text · pdf · image/OCR — one module per format
│       │   ├── comprehension/  define · summarize · glossary · simplify (ELI slider)
│       │   ├── nlp/        passive reading-pattern analysis
│       │   ├── writing/    plain-language writing checks
│       │   ├── games/      personalised practice-game generator
│       │   └── reports/    plain-language weekly summary
│       ├── services/       shared reading-data access (profile *or* device scoped)
│       ├── routes/         auth · content · sessions · support · insights · handoff · prefs
│       └── sockets/room.js shared reading room
└── client/                 React 19 + Vite + Tailwind v4
    └── src/
        ├── state/          AuthContext, PrefsContext (CSS-variable theming, server sync)
        ├── lib/            api, prefs/themes, haptics, word↔character offsets, formatting
        ├── components/     accessible UI kit (buttons, sliders, toggles, drawer, toasts)
        └── features/       library · reader · voice · tts · comprehension · writing ·
                            progress · room · handoff · auth
```

**Why a shared package?** The browser and the server must agree on what “read”,
“flagged” and “hard word” mean. Tokenising, phonics and alignment live in
`shared/` and are tested once, then imported by both (`@lexiread/core`).

**Module boundaries for extension.** Extraction, comprehension, speech
(tracking) and reporting are separate modules with no cross-imports beyond the
shared core, so adding a language or a format is additive:

```js
// server/src/modules/extract/index.js
if (kind === 'docx') return extractDocx(buffer, { title });   // one new module
// server/src/config.js
OCR_LANGS=eng+hin                                             // OCR in more scripts
```

---

## API reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | liveness probe |
| `POST` | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | PIN accounts |
| `GET` | `/api/auth/me` · `/api/auth/profiles?deviceId=` | current profile · profiles on this device |
| `GET`/`PUT` | `/api/prefs` | per-profile reading preferences |
| `POST` | `/api/content` | upload (multipart `file`) or paste (`text`) → extraction → library |
| `GET` | `/api/content` · `/api/content/:id` · `DELETE /api/content/:id` | library |
| `POST` | `/api/sessions` · `PATCH /api/sessions/:id` · `POST /api/sessions/:id/finish` | start / heartbeat / beacon flush |
| `POST` | `/api/sessions/:id/events` | batch of flags + inter-word intervals |
| `GET` | `/api/sessions` · `/api/sessions/:id` | history · resume (with events) |
| `GET` | `/api/dictionary/:word` · `POST /api/define` | meaning + 4 complexity levels + syllables |
| `POST` | `/api/summarize` | key points + glossary (+ difficulty) |
| `POST` | `/api/simplify` | rewrite text at a target level |
| `POST` | `/api/writing/check` | graded, plain-language suggestions |
| `GET` | `/api/insights` · `/api/summary/weekly` · `/api/games/from-errors` | dashboard, weekly story, mini-game |
| `POST` | `/api/handoff` · `GET /api/handoff/:code` | QR handoff |
| socket | `room:join` · `room:state` · `room:nudge` → `room:update` · `room:nudge` · `room:presence` | shared reading room |

Every read/write is scoped to either a signed-in profile or an anonymous device
id, so the whole app is usable before an account exists.

---

## Testing

```bash
npm test            # 59 tests: shared logic + server modules + full API/socket integration
npm run build       # production client build
```

- `shared/test/aligner.test.js` — the voice-following matcher: exact reads,
  skips, stumbles, mispronunciations, distant jumps, pace tracking, stalls.
- `shared/test/phonics.test.js` · `tokenize.test.js` — syllables, sound keys,
  similarity thresholds, sentence/paragraph boundaries, decimals, abbreviations.
- `server/test/comprehension.test.js` — simplification, summarising, difficulty,
  text cleanup, PDF item reconstruction, writing checks, pattern insights,
  weekly summary wording, game generation determinism.
- `server/test/api.test.js` — boots the real server (temp SQLite + port) and
  walks the whole journey: signup → prefs → upload → summarise → session with
  flags → insights → weekly → game → handoff round-trip → **live Socket.io room**
  (student publishes, helper receives, nudge comes back).

---

## Accessibility

- WCAG 2.1 AA in every colour preset; text and background pairs are contrast-checked.
- **No meaning is carried by colour alone**: flags differ by underline *style*
  (dotted / dashed / solid), carry tooltips, and are listed in a legend.
- Full keyboard path: skip link, an arrow-key reading cursor with `Enter`
  (meaning / mark read) and `H` (hear the word), visible focus rings, `Esc`
  closes panels, every control is a real button/input with a label.
- The reading surface is plain text to screen readers (no fake buttons around
  each word); status, pace and help offers are announced through polite live
  regions.
- Responsive from 320 px up, lazy-loaded routes, locally hosted fonts, no
  layout-shifting trackers. `prefers-reduced-motion` is respected.
- Copy is deliberately encouraging: no red crosses, no “wrong”, no scores that
  rank a child.

---

## Privacy for minors

- Accounts require a display name, username and PIN — no email, no phone, no
  birth date, no analytics, no third-party scripts.
- Speech recognition and synthesis run **inside the browser**; audio is never
  uploaded or stored. Only derived data (words read, flagged words, pace) is
  saved so the dashboard can help.
- The shared reading room shares the current word, sentence, stall time and pace
  while both sides have it open, and stores only the notes a helper sends.
- Pattern insights are explicitly framed as practice ideas, never as a diagnosis,
  and the disclaimer travels with the data.
- Deleting a document or profile removes its documents, sessions and events.

---

## Deployment

One service serves the API, the Socket.io channel and the built client, so
there is nothing to coordinate.

```bash
npm run build && npm start          # anywhere Node 20.11+ runs
docker build -t lexiread . && docker run -p 8787:8787 -v lexiread-data:/data lexiread
```

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sathya1245/lexiread-voice)

The button above runs the `render.yaml` blueprint: it builds the client, starts
the single Node service, health-checks `/api/health`, and attaches a 1 GB disk at
`/var/data` so profiles and progress survive deploys. **No card for the demo?**
In `render.yaml` change `plan: starter` to `plan: free` and delete the `disk:`
block — the app runs fine, it just forgets profiles when the instance restarts.

Ready-made configs are in the repo root: `Dockerfile`, `render.yaml`,
`fly.toml`. Put the service behind HTTPS (Render and Fly do this for you) — the
microphone only works on secure origins.

> **CI is parked at [`docs/ci.yml`](docs/ci.yml).** GitHub blocks OAuth apps
> (`gh`) from writing into `.github/workflows/`, so run
> `gh auth refresh -h github.com -s workflow` and move the file into place —
> the four-line recipe is at the top of the file. It runs the same `npm test`
> and `npm run build` you can run locally, plus a server smoke test.

Full walkthrough, including static-hosting recipes and a post-deploy checklist:
**[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## Roadmap

- **Multilingual support** — the phonics tables, `soundKey()` rules, OCR
  languages (`OCR_LANGS`), tokenizer ranges and the offline word knowledge are
  all data-driven, so Indic scripts (Devanagari, Kannada, Bengali) can be added
  as a language pack rather than a rewrite. Syllable segmentation for abugida
  scripts would replace `syllabify()` in a new module.
- Dictation and voice-following for a second language with the same UI.
- Teacher accounts with classroom groups and printable weekly summaries.
- Offline PWA caching of the reading surface for low-connectivity schools.
- Postgres adapter behind `server/src/db.js` for multi-instance deployment.
- Export an anonymised practice word list for speech-language specialists.

## License

MIT — see [LICENSE](LICENSE).
