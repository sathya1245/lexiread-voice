/**
 * Shared Reading Room client.
 *
 * Socket.io is imported lazily so the socket library never lands in the
 * initial bundle — a student who never opens a room never downloads it (which
 * matters on low-end phones).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useRoomSocket({ roomCode, role = 'student', name = 'Reader', onUpdate, onNudge, onPresence, enabled = true }) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);
  const [nudges, setNudges] = useState([]);
  const [presence, setPresence] = useState({ students: [], helpers: [] });
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const callbacks = useRef({ onUpdate, onNudge, onPresence });
  callbacks.current = { onUpdate, onNudge, onPresence };

  useEffect(() => {
    if (!enabled || !roomCode) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;
        const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          setConnected(true);
          socket.emit('room:join', { roomCode, role, name }, (ack) => {
            if (!ack?.ok) {
              setError(ack?.error || 'Could not join the room.');
              return;
            }
            if (ack.state) setState(ack.state);
            if (ack.nudges) setNudges(ack.nudges);
            if (ack.presence) setPresence(ack.presence);
          });
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('room:update', (payload) => {
          setState(payload);
          callbacks.current.onUpdate?.(payload);
        });
        socket.on('room:nudge', (payload) => {
          setNudges((current) => [...current, payload].slice(-20));
          callbacks.current.onNudge?.(payload);
        });
        socket.on('room:presence', (payload) => {
          setPresence(payload);
          callbacks.current.onPresence?.(payload);
        });
        socket.on('connect_error', () => setError('Live connection unavailable — check your internet connection.'));
      } catch (err) {
        setError('Live connection unavailable in this browser.');
      }
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.emit('room:leave');
        socket.close();
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [roomCode, role, name, enabled]);

  const sendState = useCallback((payload) => {
    socketRef.current?.emit('room:state', payload);
  }, []);

  const sendNudge = useCallback(
    (text, kind = 'encourage') =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) {
          resolve({ ok: false, error: 'Not connected yet.' });
          return;
        }
        socket.emit('room:nudge', { roomCode, text, kind }, resolve);
      }),
    [roomCode]
  );

  return { connected, state, nudges, presence, error, sendState, sendNudge };
}
