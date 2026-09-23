export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function formatDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes >= 1) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

export function percent(part, whole) {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Split a word into bionic-reading chunks (first 1-2 letters bolded). */
export function bionicParts(word) {
  const clean = String(word || '');
  if (clean.length <= 1) return { head: clean, tail: '' };
  const headLen = clean.length <= 4 ? 1 : clean.length <= 7 ? 1 : 2;
  const match = clean.slice(0, headLen + 1).match(/^[\p{L}\p{N}']+/u);
  const len = match ? Math.min(match[0].length, headLen) : headLen;
  return { head: clean.slice(0, len), tail: clean.slice(len) };
}
