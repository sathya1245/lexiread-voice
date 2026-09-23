import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_PREFS, applyPrefs, clamp, loadLocalPrefs, saveLocalPrefs } from '../lib/prefs.js';
import { setHapticsEnabled } from '../lib/haptics.js';
import { useAuth } from './AuthContext.jsx';

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState(() => loadLocalPrefs());
  const [syncState, setSyncState] = useState('local');
  const saveTimer = useRef(null);

  // Apply to the DOM immediately (fonts, spacing, theme, overlay tint).
  useEffect(() => {
    applyPrefs(prefs);
    setHapticsEnabled(prefs.haptics);
  }, [prefs]);

  // Pull the signed-in profile's saved preferences once.
  useEffect(() => {
    let cancelled = false;
    if (!profile) {
      setSyncState('device');
      return undefined;
    }
    (async () => {
      try {
        const { prefs: remote } = await api.get('/prefs');
        if (cancelled) return;
        if (remote) setPrefs({ ...DEFAULT_PREFS, ...remote });
        setSyncState('synced');
      } catch {
        if (!cancelled) setSyncState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const persist = useCallback(
    (next) => {
      saveLocalPrefs(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!profile) {
        setSyncState('device');
        return;
      }
      setSyncState('saving');
      saveTimer.current = setTimeout(async () => {
        try {
          await api.put('/prefs', { prefs: next });
          setSyncState('synced');
        } catch {
          setSyncState('error');
        }
      }, 600);
    },
    [profile]
  );

  const setPref = useCallback(
    (key, value) => {
      setPrefs((current) => {
        const next = { ...current, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setMany = useCallback(
    (patch) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const nudgeFont = useCallback(
    (delta) => setPrefs((current) => {
      const next = { ...current, fontScale: clamp(current.fontScale + delta, 14, 34) };
      persist(next);
      return next;
    }),
    [persist]
  );

  const resetPrefs = useCallback(() => {
    const next = { ...DEFAULT_PREFS };
    setPrefs(next);
    persist(next);
  }, [persist]);

  const value = useMemo(
    () => ({ prefs, setPref, setMany, nudgeFont, resetPrefs, syncState }),
    [prefs, setPref, setMany, nudgeFont, resetPrefs, syncState]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return ctx;
}
