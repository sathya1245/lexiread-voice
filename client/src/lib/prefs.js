/**
 * Reader preferences.
 *
 * One plain object drives fonts, spacing, colour theme, overlay tint, voice and
 * haptics. It is applied to the DOM through CSS variables (see index.css) so the
 * reading surface re-styles instantly, and it is stored per profile on the
 * server when signed in (or on the device when anonymous).
 */

export const FONTS = [
  { id: 'lexend', label: 'Lexend', css: 'var(--font-lexend)', hint: 'Designed for reading fluency — the recommended default.' },
  { id: 'opendyslexic', label: 'OpenDyslexic', css: 'var(--font-opendyslexic)', hint: 'Heavier letter bases that reduce letter flipping.' },
  { id: 'plain', label: 'Plain (Verdana)', css: 'var(--font-plain)', hint: 'A familiar, wide, screen-friendly font.' },
];

export const THEMES = [
  { id: 'cream', label: 'Cream', tint: '#ffd7a1', hint: 'Warm paper — the gentlest default.' },
  { id: 'blue', label: 'Soft blue', tint: '#a9c9e4', hint: 'Cool blue calms glare for many readers.' },
  { id: 'yellow', label: 'Soft yellow', tint: '#ffe89a', hint: 'Bright but low-glare, good under lights.' },
  { id: 'mint', label: 'Mint', tint: '#b6e0c6', hint: 'Green-toned, easy on tired eyes.' },
  { id: 'lavender', label: 'Lavender', tint: '#cfc2ee', hint: 'Purple tints help some readers track lines.' },
  { id: 'grey', label: 'Grey', tint: '#c9c9c9', hint: 'Neutral, low-saturation background.' },
  { id: 'dark', label: 'Night', tint: '#3a4a52', hint: 'Dark background for evening reading.' },
];

export const DEFAULT_PREFS = {
  font: 'lexend',
  fontScale: 19,
  lineHeight: 1.7,
  letterSpacing: 0.01,
  wordSpacing: 0.06,
  measure: 66,
  theme: 'cream',
  tint: 0,
  tintColor: '#ffd7a1',
  bionic: false,
  mode: 'voice',
  speechRate: 0.95,
  speechPitch: 1,
  voiceURI: null,
  stuckMs: 3500,
  haptics: true,
  autoScroll: true,
  highlightSentence: false,
  showLegend: true,
  showPace: true,
};

export const PREF_STORAGE_KEY = 'lexiread.prefs';

export function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveLocalPrefs(prefs) {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota/private mode */
  }
}

/** Push the preference object into CSS variables and the theme attribute. */
export function applyPrefs(prefs) {
  const root = document.documentElement;
  const font = FONTS.find((f) => f.id === prefs.font) || FONTS[0];
  root.style.setProperty('--lr-reader-font', font.css);
  root.style.setProperty('--lr-font-size', `${prefs.fontScale}px`);
  root.style.setProperty('--lr-line-height', String(prefs.lineHeight));
  root.style.setProperty('--lr-letter-spacing', `${prefs.letterSpacing}em`);
  root.style.setProperty('--lr-word-spacing', `${prefs.wordSpacing}em`);
  root.style.setProperty('--lr-measure', `${prefs.measure}ch`);
  root.dataset.theme = prefs.theme;
  root.style.setProperty('--lr-tint', prefs.tint > 0 ? prefs.tintColor : 'transparent');

  let tintLayer = document.getElementById('lexiread-tint');
  if (!tintLayer) {
    tintLayer = document.createElement('div');
    tintLayer.id = 'lexiread-tint';
    tintLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tintLayer);
  }
  tintLayer.style.backgroundColor = prefs.tintColor;
  tintLayer.style.opacity = String(Math.max(0, Math.min(1, prefs.tint / 100)));
  tintLayer.style.display = prefs.tint > 0 ? 'block' : 'none';
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
