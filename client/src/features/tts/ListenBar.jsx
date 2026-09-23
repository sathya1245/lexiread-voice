/**
 * Listen mode (narrated reading).
 *
 * The app reads aloud and the highlight follows the voice. This is the
 * fallback for younger readers who are not ready to read independently yet —
 * the same document, the same position, just a different way in.
 */

import { Alert, Button, Pill, RangeSlider, Select } from '../../components/ui.jsx';

export function ListenBar({
  supported,
  speaking,
  paused,
  voices,
  prefs,
  setPref,
  onPlay,
  onPause,
  onResume,
  onStop,
  cursorWord,
  onRestartFromCursor,
  progress,
}) {
  if (!supported) {
    return (
      <Alert tone="gentle" title="Reading aloud is not available in this browser">
        Try Chrome, Edge or Safari. You can still read with voice-following or tap words as you go.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!speaking ? (
          <Button size="lg" onClick={onPlay}>
            ▶ Read aloud
          </Button>
        ) : (
          <>
            {paused ? (
              <Button size="lg" onClick={onResume}>
                ▶ Carry on
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={onPause}>
                ⏸ Pause
              </Button>
            )}
            <Button size="lg" variant="ghost" onClick={onStop}>
              ⏹ Stop
            </Button>
            <Button size="lg" variant="soft" onClick={onRestartFromCursor}>
              ⟲ Start from here
            </Button>
          </>
        )}
        <Pill tone="accent">{progress}% through</Pill>
      </div>

      <p aria-live="polite" className="text-sm text-[var(--lr-ink-soft)]">
        {speaking && !paused
          ? cursorWord
            ? `Reading… now at “${cursorWord}”`
            : 'Reading…'
          : paused
            ? 'Paused — tap Carry on when you are ready.'
            : 'Tap Read aloud and the words will be highlighted as they are spoken.'}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <RangeSlider
            label="Speaking speed"
            value={prefs.speechRate}
            min={0.5}
            max={1.6}
            step={0.05}
            onChange={(v) => setPref('speechRate', v)}
            format={(v) => `${v.toFixed(2)}×`}
            hint="Slower is easier to follow when the text is new."
          />
        </div>
        <RangeSlider
          label="Pitch"
          value={prefs.speechPitch}
          min={0.6}
          max={1.6}
          step={0.05}
          onChange={(v) => setPref('speechPitch', v)}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div>
        <label htmlFor="listen-voice" className="text-sm font-semibold">
          Voice
        </label>
        <Select id="listen-voice" value={prefs.voiceURI || ''} onChange={(e) => setPref('voiceURI', e.target.value || null)}>
          <option value="">Device default</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
