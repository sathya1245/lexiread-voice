# Voice-following guided reading — how it works

This is the feature the whole product is organised around, so here is the full
walkthrough: the problem, the algorithm, the tuning decisions, and exactly where
each piece of code lives.

## The problem

The student reads out loud. `SpeechRecognition` streams text like this:

```
the ... the cat sat on the ... mat ... yeah the mat
```

Meanwhile the document says:

```
The cat sat on the mat. The dog ran fast!
```

We must decide, continuously and cheaply:

1. which document word was just read (to move the highlight),
2. which document words were skipped or mispronounced (to log for practice),
3. whether the student has stalled (to offer help exactly once),
4. how fast they are reading (live pace),
5. all of it without ever interrupting, correcting or shaming the reader.

A naive `transcript.indexOf(nextWord)` loop fails immediately: recognisers
return phonetic spellings (`fotosinthesis`), split compound words
(`photo synthesis`), drop short words, and repeat themselves. It also cannot
tell “the student skipped a word” from “the recogniser ate a word”.

## Pipeline

```
 SpeechRecognition events
        │  (interim + final results)
        ▼
 delta tokens only ──────────────► pending token buffer (max 16)
 (per-result transcript diff)              │
                                           ▼
                          shared/aligner.js · alignTranscript()
                    anchored DP over the upcoming-window words
                                           │
        ┌──────────────────────────────────┼────────────────────────────────┐
        ▼                                  ▼                                ▼
  matches (exact / close)          skipped words + confidence        consumeThrough
   → highlight, haptics             → soft flags → practice log        (token recycling)
```

### 1. Only the delta is processed

Each `result` index keeps its last transcript. When the recogniser replaces an
interim result with the final version of the same speech, the token-level common
prefix is skipped, so nothing is ever counted twice — this is what lets the
highlight move in real time on interim results without double-advancing when the
final arrives (`client/src/features/voice/useVoiceFollow.js`).

### 2. Anchored dynamic-programming alignment

`alignTranscript({ spoken, words, cursor })` aligns the spoken tokens against
document words in `[cursor - lookback, cursor + windowSize]` using the classic
edit-distance recurrence, maximising total score:

| Move | Meaning | Score |
| --- | --- | --- |
| match `spoken[s] ↔ word[t]` | the student read that word | `similarity()` (0–1) |
| skip spoken | filler, repeat, cough, recogniser noise | 0 |
| skip word | the student skipped a document word | `-0.3` |

Answering with the *whole-window* optimum rather than a greedy first hit is what
makes repeated words (`the … the … the`) resolve in order and stumbles stay put.

Tuning details that matter:

- **Acceptance threshold scales with word length** (`acceptanceThreshold`):
  ≤3 letters must match almost exactly (else `cat` swallows `can`/`cap`),
  4 letters need 0.85, 6 need 0.70, longer words 0.60. Without this, short
  function words cause catastrophic misalignment.
- **Free trailing words**: the DP backtracks from the best state ending *anywhere*
  in the window, so words after the last match cost nothing. Reading the first
  sentence of a long paragraph still registers progress.
- **Anchoring**: an alignment is rejected unless its first match is within
  `cursor + lookback + 1`. A single stray match in the distance cannot yank the
  highlight forward.
- **Similarity blends spelling and sound** (`shared/phonics.js`):
  `similarity()` takes the better of edit-distance similarity and phonetic-key
  similarity. `soundKey()` collapses `ph→f`, `ck→k`, `qu→kw`, `x→ks`, silent
  trailing `e`, doubled letters and vowel runs, so `fotosinthesis`,
  `foto synthesis` and `photosynthesis` all land on `fotosinthesis`.

### 3. Honest, gentle flagging

- **Close match** (`score < 0.92`) → `close` flag: dotted underline, tooltip
  showing what was heard, logged as a pronunciation wobble.
- **Skipped word** → `skipped` (long word, ≥5 letters, high confidence) or
  `unclear` (short function word, low confidence). A dropped recogniser token is
  indistinguishable from a skipped “on”, so the app says so instead of accusing.
- **Student-marked** → `difficult` when they tap “mark as tricky”, or when they
  accepted the “tap to hear this word” offer (which implies “I couldn't read this”).
- Every flag is queued and posted in batches (`POST /api/sessions/:id/events`),
  never one request per word.

### 4. Stall detection

`nextHelpOffer({ cursor, lastProgressAt, now, stuckMs, alreadyOffered })`
returns the word to offer *once* per position. The UI shows a soft, dismissible
“Take your time. Want to hear `photosynthesis` first?” with a TTS button — no
alarm, no timer pressure, and never before reading has actually started.

### 5. Pace, fluency and haptics

- `createPaceTracker()` keeps timestamped progress samples over a rolling 30 s
  window → an honest WPM that ignores pauses instead of averaging them in.
- Inter-word gaps are recorded (capped, and only in the 60 ms – 30 s range) and
  summarised with `paceVariance()` → mean, standard deviation and a variance
  coefficient. A high coefficient becomes “reading speed goes up and down —
  reading together in a steady rhythm can help”, never a score.
- `isHapticBragWord()` (3+ syllables, a digraph, or a 6+ letter blend) fires a
  three-pulse vibration on success; ordinary words get a single tap. Positive
  reinforcement only.

### 6. Three modes, one position

Voice-following, narrated TTS and tap-to-read all drive the same `cursor`, the
same flag map and the same session record, so switching mode never loses the
student's place. The tap path calls the identical bookkeeping
(`markWordRead`), which is why it also works as the accessibility fallback on
browsers without `SpeechRecognition`.

## What the tests pin down

`shared/test/aligner.test.js` (17 cases):

| Behaviour | Test |
| --- | --- |
| normal reading advances word by word | `exact reading advances the cursor word by word` |
| partial reading of a long paragraph still counts | `reading part of a long paragraph still registers (no trailing penalty)` |
| genuine skips are reported; short ones as low confidence | `a genuinely skipped word is reported…`, `a long skipped word is high confidence` |
| mispronunciation still matches, flagged `close` | `mispronounced long word still matches, flagged as close` |
| short words do not cross-match | `short words do not cross-match` |
| filler words are ignored | `filler words are ignored without flagging document words` |
| jumping ahead is rejected | `jumping ahead to a distant matching word is rejected` |
| stumbles and repeats resolve in order | `stumbling by repeating a word…`, `repeats of the same word resolve in order` |
| gibberish never moves the cursor | `gibberish does not move the cursor` |
| pace + stall helpers | `pace tracker reports words per minute…`, `help offer fires once after a stall` |

Run them with:

```bash
node --test shared/test/aligner.test.js
```

## Tuning it on a real device

All of these are single constants:

| Knob | File | Default | Effect |
| --- | --- | --- | --- |
| `windowSize` | `shared/aligner.js` | 12 | how far ahead the matcher looks |
| `lookback` | `shared/aligner.js` | 2 | how many previous words can re-match |
| `skipPenalty` | `shared/aligner.js` | 0.3 | higher → fewer false “skipped” flags |
| `acceptanceThreshold()` | `shared/aligner.js` | length-based | strictness for short words |
| `stuckMs` | reader preference | 3500 | how long a pause is before help is offered |
| `maxSpoken` | `shared/aligner.js` | 14 | transcript tail considered per pass |

If a school's accents or a language pack need different behaviour, replacing
`soundKey()` and `acceptanceThreshold()` is enough — the alignment, flagging,
pacing and UI layers stay untouched.
