/**
 * App shell: routes, navigation and the provider stack.
 *
 * Heavy pages (reader, dashboard, writing, rooms) are lazy-loaded so the home
 * screen stays small and quick on a low-end phone.
 */

import { Suspense, lazy } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Button, Spinner } from './components/ui.jsx';
import { cx } from './lib/format.js';
import { HomePage } from './features/library/HomePage.jsx';
import { useAuth } from './state/AuthContext.jsx';

const ReadPage = lazy(() => import('./features/reader/ReadPage.jsx').then((m) => ({ default: m.ReadPage })));
const WritePage = lazy(() => import('./features/writing/WritePage.jsx').then((m) => ({ default: m.WritePage })));
const ProgressPage = lazy(() => import('./features/progress/ProgressPage.jsx').then((m) => ({ default: m.ProgressPage })));
const RoomPage = lazy(() => import('./features/room/RoomPage.jsx').then((m) => ({ default: m.RoomPage })));
const ResumePage = lazy(() => import('./features/handoff/ResumePage.jsx').then((m) => ({ default: m.ResumePage })));
const SignInPage = lazy(() => import('./features/auth/SignInPage.jsx').then((m) => ({ default: m.SignInPage })));

const NAV = [
  { to: '/', label: 'Library', end: true },
  { to: '/write', label: 'Writing' },
  { to: '/progress', label: 'Progress' },
  { to: '/room', label: 'Helper view' },
];

function Nav() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  if (location.pathname.startsWith('/read/') || location.pathname.startsWith('/resume/')) return null;

  return (
    <header className="border-b border-[var(--lr-rule)] bg-[var(--lr-bg)]">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
        <Link to="/" className="mr-2 text-lg font-extrabold tracking-tight">
          Lexi<span className="text-[var(--lr-accent)]">Read</span>
        </Link>
        <ul className="flex flex-1 flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'inline-block rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-[var(--lr-accent-soft)] text-[var(--lr-ink)]'
                      : 'text-[var(--lr-ink-soft)] hover:bg-[var(--lr-surface-2)] hover:text-[var(--lr-ink)]'
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <span className="rounded-full bg-[var(--lr-surface-2)] px-3 py-1 text-xs font-bold">
                {profile.displayName}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <Button as={Link} to="/signin" variant="secondary" size="sm">
              Profiles
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}

function Loading({ label = 'Loading…' }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Spinner label={label} />
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--lr-bg)] text-[var(--lr-ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-[var(--lr-accent)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[var(--lr-accent-ink)]"
      >
        Skip to main content
      </a>
      <Nav />
      <div id="main-content">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/read/:documentId" element={<ReadPage />} />
            <Route path="/write" element={<WritePage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/room" element={<RoomPage />} />
            <Route path="/room/:roomCode" element={<RoomPage />} />
            <Route path="/resume/:code" element={<ResumePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
      <footer className="border-t border-[var(--lr-rule)] px-4 py-6 text-center text-xs text-[var(--lr-ink-soft)]">
        <p>
          LexiRead runs entirely with browser speech APIs and free dictionary data. Pattern notes are practice ideas,
          never a diagnosis.
        </p>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">This page is not here</h1>
      <p className="mt-2 text-sm text-[var(--lr-ink-soft)]">
        The link may be old, or the reading session has finished.
      </p>
      <Link className="mt-4 inline-block font-semibold underline" to="/">
        Back to my library
      </Link>
    </div>
  );
}
