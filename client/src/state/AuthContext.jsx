import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getDeviceId, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const deviceId = getDeviceId();

  const refreshProfiles = useCallback(async () => {
    try {
      const { profiles: list } = await api.get(`/auth/profiles?deviceId=${encodeURIComponent(deviceId)}`);
      setProfiles(list || []);
    } catch {
      setProfiles([]);
    }
  }, [deviceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getToken()) {
          const { profile: me } = await api.get('/auth/me');
          if (!cancelled) setProfile(me);
        }
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
      refreshProfiles();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfiles]);

  const signIn = useCallback(
    async (username, pin) => {
      setError(null);
      const res = await api.post('/auth/login', { username, pin, deviceId });
      setToken(res.token);
      setProfile(res.profile);
      await refreshProfiles();
      return res.profile;
    },
    [deviceId, refreshProfiles]
  );

  const signUp = useCallback(
    async ({ username, displayName, pin, role }) => {
      setError(null);
      const res = await api.post('/auth/signup', { username, displayName, pin, role, deviceId });
      setToken(res.token);
      setProfile(res.profile);
      await refreshProfiles();
      return res.profile;
    },
    [deviceId, refreshProfiles]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* signing out locally is enough */
    }
    setToken(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, profiles, deviceId, loading, error, setError, signIn, signUp, signOut, refreshProfiles, isSignedIn: Boolean(profile) }),
    [profile, profiles, deviceId, loading, error, signIn, signUp, signOut, refreshProfiles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
