/**
 * Progress dashboard.
 *
 * Leads with the plain-language weekly summary rather than charts (charts are
 * optional detail below), keeps every insight practice-focused, and shows the
 * disclaimer wherever pattern data appears.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Pill, SectionTitle, SegmentedControl, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { formatDuration, formatRelative } from '../../lib/format.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { usePrefs } from '../../state/PrefsContext.jsx';
import { speakWord } from '../tts/useTts.js';
import { PracticeGame } from './PracticeGame.jsx';

function StatCard({ label, value, hint }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-[var(--lr-ink-soft)]">{label}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--lr-ink-soft)]">{hint}</p> : null}
    </Card>
  );
}

function WeeklySummaryCard({ summary, speech }) {
  if (!summary) return null;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle level={2} hint="Written to be read out loud to a parent or teacher.">
          This week
        </SectionTitle>
        <Pill tone="accent">{summary.stats.sessions} sessions</Pill>
      </div>
      <p className="text-base font-bold">{summary.headline}</p>
      <div className="space-y-2 text-[0.98rem] leading-relaxed">
        {summary.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {summary.practiceWords.length ? (
        <div className="rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface-2)] p-3">
          <p className="text-sm font-bold">Words to practise together</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {summary.practiceWords.map((word) => (
              <li key={word.word}>
                <Button size="sm" variant="soft" onClick={() => speakWord(word.word, speech)} title={word.why}>
                  🔊 {word.word}
                </Button>
              </li>
            ))}
          </ul>
          {summary.practiceWords[0]?.parts?.length > 1 ? (
            <p className="mt-2 text-xs text-[var(--lr-ink-soft)]">
              Beats for the hardest one: {summary.practiceWords[0].parts.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs text-[var(--lr-ink-soft)]">{summary.disclaimer}</p>
    </Card>
  );
}

export function ProgressPage() {
  const { profile, isSignedIn } = useAuth();
  const { prefs } = usePrefs();
  const speech = { rate: prefs.speechRate, pitch: prefs.speechPitch, voiceURI: prefs.voiceURI };
  const [days, setDays] = useState(30);
  const [insights, setInsights] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [game, setGame] = useState(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insightData, weeklyData] = await Promise.all([
        api.get(`/insights?days=${days}&name=${encodeURIComponent(profile?.displayName || 'your reader')}`),
        api.get(`/summary/weekly?days=7&name=${encodeURIComponent(profile?.displayName || 'your reader')}`),
      ]);
      setInsights(insightData);
      setWeekly(weeklyData.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, profile?.displayName]);

  const loadGame = useCallback(async () => {
    setGameLoading(true);
    try {
      const data = await api.get('/games/from-errors?days=120');
      setGame(data.game);
    } catch {
      setGame(null);
    } finally {
      setGameLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const stats = insights?.stats;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          level={1}
          hint={`Reading history for ${isSignedIn ? profile.displayName : 'this device'}. Pattern notes describe words to practise — they are never a diagnosis.`}
        >
          My reading progress
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Time range"
            value={days}
            onChange={setDays}
            size="sm"
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '3 months' },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <Alert tone="gentle" title="Could not load the dashboard">{error}</Alert> : null}
      {loading && !insights ? <Spinner label="Gathering your reading history…" /> : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Sessions" value={stats.sessions} />
          <StatCard label="Time reading" value={`${stats.minutes}m`} />
          <StatCard label="Words read" value={stats.wordsRead} />
          <StatCard label="Average pace" value={stats.avgWpm ? `${stats.avgWpm}` : '–'} hint="words per minute" />
          <StatCard label="Best pace" value={stats.bestWpm ? `${stats.bestWpm}` : '–'} hint="words per minute" />
          <StatCard label="Words to practise" value={stats.distinctFlaggedWords} />
        </div>
      ) : null}

      <WeeklySummaryCard summary={weekly} speech={speech} />

      {insights ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="space-y-3">
            <SectionTitle level={2} hint="Gentle patterns from your own reading sessions.">
              What your reading shows
            </SectionTitle>
            <ul className="space-y-3">
              {insights.insights.map((insight) => (
                <li key={insight.kind} className="rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface-2)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="accent">{insight.tone}</Pill>
                    <p className="font-bold">{insight.title}</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{insight.detail}</p>
                  {insight.words?.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {insight.words.slice(0, 6).map((word) => (
                        <li key={word}>
                          <Button size="sm" variant="ghost" onClick={() => speakWord(word, speech)}>
                            🔊 {word}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--lr-ink-soft)]">{insights.disclaimer}</p>
            {insights.fluency ? (
              <p className="text-xs text-[var(--lr-ink-soft)]">
                Rhythm detail: words took about {(insights.fluency.meanMs / 1000).toFixed(1)}s each, varying by ±
                {(insights.fluency.stdevMs / 1000).toFixed(1)}s.
              </p>
            ) : null}
          </Card>

          <div className="space-y-4">
            <Card className="space-y-2">
              <SectionTitle level={2} hint="The words that slowed reading down most, worst first.">
                Practice words
              </SectionTitle>
              {insights.practiceWords?.length ? (
                <ul className="space-y-2">
                  {insights.practiceWords.slice(0, 8).map((word) => (
                    <li
                      key={word.word}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--lr-rule)] p-2.5"
                    >
                      <div>
                        <p className="font-bold">{word.word}</p>
                        <p className="text-xs text-[var(--lr-ink-soft)]">
                          {word.syllables} beats · {word.familyLabel}
                          {word.types?.difficult ? ' · you marked it tricky' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="soft" onClick={() => speakWord(word.word, speech)}>
                          🔊
                          <span className="sr-only">Hear {word.word}</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => speakWord(word.parts.join(', '), speech)}>
                          beats
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--lr-ink-soft)]">
                  Nothing flagged yet. Read a passage in voice mode and words that need practice will appear here.
                </p>
              )}
            </Card>

            <Card className="space-y-2">
              <SectionTitle level={2}>Recent sessions</SectionTitle>
              {insights.recentSessions?.length ? (
                <ul className="space-y-2 text-sm">
                  {insights.recentSessions.slice(0, 8).map((session) => (
                    <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--lr-rule)] pb-2 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{session.title || 'Untitled'}</p>
                        <p className="text-xs text-[var(--lr-ink-soft)]">
                          {formatRelative(session.startedAt)} · {session.mode === 'narrated' ? 'listened' : 'read aloud'} ·{' '}
                          {formatDuration(session.durationMs)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill>{session.wordsRead} words</Pill>
                        {session.wpmAvg ? <Pill>{session.wpmAvg} wpm</Pill> : null}
                        <Link className="text-xs font-semibold underline" to={`/read/${session.id}`}>
                          view
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--lr-ink-soft)]">No sessions in this period.</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      <PracticeGame game={game} speech={speech} onReload={loadGame} loading={gameLoading} />

      <Card>
        <SectionTitle level={2} hint="A helper joins with the room code from the student's reader.">
          For a grown-up helper
        </SectionTitle>
        <p className="text-sm text-[var(--lr-ink-soft)]">
          Open the shared reading room to follow along live and send quiet encouragement notes. The student's reader shows
          a code under “Read together”.
        </p>
        <div className="mt-3">
          <Link
            className="inline-flex items-center rounded-xl border border-[var(--lr-rule)] px-3 py-2 text-sm font-semibold"
            to="/room"
          >
            Open the helper view
          </Link>
        </div>
      </Card>
    </div>
  );
}
