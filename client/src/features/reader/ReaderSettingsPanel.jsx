/**
 * Reader settings: fonts, spacing, colour themes, the tint overlay, bionic
 * reading, speech and haptics. Every control is a labelled form element and
 * each preview updates live, so the student can see the change as they make it.
 */

import { Button, Pill, RangeSlider, SectionTitle, Select, Toggle } from '../../components/ui.jsx';
import { FONTS, THEMES } from '../../lib/prefs.js';
import { hapticsSupported, HAPTIC, buzz } from '../../lib/haptics.js';
import { cx } from '../../lib/format.js';

const TINT_COLORS = ['#ffd7a1', '#ffe89a', '#b6e0c6', '#a9c9e4', '#cfc2ee', '#e6b6b6', '#c9c9c9'];

export function ReaderSettingsPanel({ prefs, setPref, setMany, resetPrefs, syncState, voices = [] }) {
  return (
    <div className="space-y-5">
      <section>
        <SectionTitle hint="Letter shapes matter more than size for many readers.">Font</SectionTitle>
        <div className="space-y-2">
          {FONTS.map((font) => (
            <label
              key={font.id}
              className={cx(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
                prefs.font === font.id
                  ? 'border-[var(--lr-accent)] bg-[var(--lr-accent-soft)]'
                  : 'border-[var(--lr-rule)] bg-[var(--lr-surface)]'
              )}
            >
              <input
                type="radio"
                name="reader-font"
                value={font.id}
                checked={prefs.font === font.id}
                onChange={() => setPref('font', font.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-bold" style={{ fontFamily: font.css }}>
                  {font.label}
                </span>
                <span className="block text-xs text-[var(--lr-ink-soft)]">{font.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle hint="Bigger, airier text is often easier than magnifying the screen.">Size & spacing</SectionTitle>
        <RangeSlider
          label="Text size"
          value={prefs.fontScale}
          min={14}
          max={34}
          step={1}
          onChange={(v) => setPref('fontScale', v)}
          format={(v) => `${v}px`}
        />
        <RangeSlider
          label="Line spacing"
          value={prefs.lineHeight}
          min={1.3}
          max={2.6}
          step={0.05}
          onChange={(v) => setPref('lineHeight', v)}
          format={(v) => `${v.toFixed(2)}×`}
          hint="Roomier lines stop the eye jumping to the line below."
        />
        <RangeSlider
          label="Letter spacing"
          value={prefs.letterSpacing}
          min={0}
          max={0.16}
          step={0.005}
          onChange={(v) => setPref('letterSpacing', v)}
          format={(v) => `${(v * 100).toFixed(1)}%`}
        />
        <RangeSlider
          label="Word spacing"
          value={prefs.wordSpacing}
          min={0}
          max={0.4}
          step={0.01}
          onChange={(v) => setPref('wordSpacing', v)}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <RangeSlider
          label="Line length"
          value={prefs.measure}
          min={34}
          max={100}
          step={2}
          onChange={(v) => setPref('measure', v)}
          format={(v) => `${v} characters`}
        />
      </section>

      <section>
        <SectionTitle hint="Irlen-style colour filters help some readers by lowering glare.">
          Background & colour
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              aria-pressed={prefs.theme === theme.id}
              title={theme.hint}
              onClick={() => setMany({ theme: theme.id, tintColor: theme.tint })}
              className={cx(
                'rounded-xl border p-2 text-left text-xs font-semibold',
                prefs.theme === theme.id ? 'border-[var(--lr-accent)]' : 'border-[var(--lr-rule)]'
              )}
              data-theme={theme.id}
            >
              <span
                aria-hidden="true"
                className="mb-1.5 block h-6 w-full rounded-md border border-black/10"
                style={{ backgroundColor: `var(--lr-bg)`.replace('var(--lr-bg)', '') || undefined, background: themeTint(theme.id) }}
              />
              {theme.label}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-3">
          <RangeSlider
            label="Overlay tint strength"
            value={prefs.tint}
            min={0}
            max={60}
            step={2}
            onChange={(v) => setPref('tint', v)}
            format={(v) => (v === 0 ? 'off' : `${v}%`)}
            hint="Adds a coloured overlay on top of everything — useful for strong visual stress."
          />
          <div>
            <p className="mb-1.5 text-sm font-semibold">Overlay colour</p>
            <div className="flex flex-wrap gap-2">
              {TINT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Overlay colour ${color}`}
                  aria-pressed={prefs.tintColor === color}
                  onClick={() => setPref('tintColor', color)}
                  className={cx(
                    'h-8 w-8 rounded-full border-2',
                    prefs.tintColor === color ? 'border-[var(--lr-accent)]' : 'border-[var(--lr-rule)]'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle hint="Bold openings act like a finger pointing at where each word starts.">
          Reading aids
        </SectionTitle>
        <Toggle
          label="Bionic reading"
          checked={prefs.bionic}
          onChange={(v) => setPref('bionic', v)}
          hint="Bolds the first letters of every word."
        />
        <Toggle
          label="Highlight the current sentence"
          checked={prefs.highlightSentence}
          onChange={(v) => setPref('highlightSentence', v)}
        />
        <Toggle
          label="Follow along automatically"
          checked={prefs.autoScroll}
          onChange={(v) => setPref('autoScroll', v)}
          hint="Scrolls the page to keep the current word in view."
        />
        <Toggle
          label="Show the flag legend"
          checked={prefs.showLegend}
          onChange={(v) => setPref('showLegend', v)}
        />
        <Toggle
          label="Buzz for hard words (phone)"
          checked={prefs.haptics}
          onChange={(v) => {
            setPref('haptics', v);
            if (v) buzz(HAPTIC.hardWord);
          }}
          hint={
            hapticsSupported()
              ? 'A little vibration celebrates tricky words read correctly.'
              : 'This device has no vibration motor — the setting is saved for phones.'
          }
        />
      </section>

      <section className="space-y-3">
        <SectionTitle hint="These settings are used by Listen mode and the word buttons.">Voice</SectionTitle>
        <div>
          <label htmlFor="voice-select" className="text-sm font-semibold">
            Voice
          </label>
          <Select
            id="voice-select"
            value={prefs.voiceURI || ''}
            onChange={(e) => setPref('voiceURI', e.target.value || null)}
          >
            <option value="">Device default</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </Select>
        </div>
        <RangeSlider
          label="Speaking speed"
          value={prefs.speechRate}
          min={0.5}
          max={1.6}
          step={0.05}
          onChange={(v) => setPref('speechRate', v)}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <RangeSlider
          label="Pitch"
          value={prefs.speechPitch}
          min={0.6}
          max={1.6}
          step={0.05}
          onChange={(v) => setPref('speechPitch', v)}
          format={(v) => v.toFixed(2)}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--lr-rule)] pt-4">
        <Button variant="secondary" size="sm" onClick={resetPrefs}>
          Reset to defaults
        </Button>
        <Pill>
          {syncState === 'synced'
            ? 'Saved to your profile'
            : syncState === 'saving'
              ? 'Saving…'
              : syncState === 'error'
                ? 'Saved on this device (server unavailable)'
                : 'Saved on this device'}
        </Pill>
      </div>
    </div>
  );
}

function themeTint(id) {
  const map = {
    cream: '#faf3e2',
    blue: '#e8f1f7',
    yellow: '#fbf4cf',
    mint: '#e7f2ea',
    lavender: '#eeeaf7',
    grey: '#eceae5',
    dark: '#1d2226',
  };
  return map[id] || '#faf3e2';
}
