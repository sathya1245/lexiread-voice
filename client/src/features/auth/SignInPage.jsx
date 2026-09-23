/**
 * Lightweight accounts. Only three things are asked for: a name to show, a
 * username, and a 4–6 digit PIN. No email, no birth date — nothing about a
 * child beyond what the family types in.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Field, Pill, SectionTitle, SegmentedControl, TextInput } from '../../components/ui.jsx';
import { useAuth } from '../../state/AuthContext.jsx';

export function SignInPage() {
  const navigate = useNavigate();
  const { signIn, signUp, profiles, isSignedIn, profile, signOut, refreshProfiles } = useAuth();
  const [tab, setTab] = useState('signin');
  const [form, setForm] = useState({ username: '', displayName: '', pin: '', role: 'student' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'signin') await signIn(form.username, form.pin);
      else await signUp(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4">
      <SectionTitle level={1} hint="Profiles keep each reader's font, colours, spacing and practice words separate.">
        Profiles
      </SectionTitle>

      {isSignedIn ? (
        <Card className="mb-4">
          <p className="text-sm">
            Signed in as <strong>{profile.displayName}</strong> (@{profile.username}).
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => signOut()}>
              Sign out
            </Button>
            <Button variant="ghost" onClick={() => refreshProfiles()}>
              Refresh profiles
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <SegmentedControl
            label="Account action"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'New profile' },
            ]}
          />
          <form className="mt-3 space-y-3" onSubmit={submit}>
            {tab === 'signup' ? (
              <>
                <Field label="Name to show" hint="A first name or nickname is plenty.">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={form.displayName}
                      onChange={update('displayName')}
                      autoComplete="off"
                      placeholder="Aditi"
                    />
                  )}
                </Field>
                <Field label="Who is this profile for?" hint="Helpers (teachers, parents) do not need their own PIN memory routine — but they get a profile too.">
                  {() => (
                    <SegmentedControl
                      label="Profile type"
                      value={form.role}
                      onChange={(role) => setForm((current) => ({ ...current, role }))}
                      options={[
                        { value: 'student', label: 'Reader' },
                        { value: 'helper', label: 'Helper' },
                      ]}
                    />
                  )}
                </Field>
              </>
            ) : null}
            <Field label="Username" hint="Letters and numbers only.">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.username}
                  onChange={update('username')}
                  autoComplete="username"
                  placeholder="aditi"
                />
              )}
            </Field>
            <Field label="PIN" hint="4 to 6 digits. Only this device sees it in plain text while you type.">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.pin}
                  onChange={update('pin')}
                  inputMode="numeric"
                  autoComplete="off"
                  type="password"
                  placeholder="••••"
                />
              )}
            </Field>
            <Button type="submit" disabled={busy} size="lg">
              {busy ? 'Working…' : tab === 'signin' ? 'Sign in' : 'Create profile'}
            </Button>
          </form>
          {error ? (
            <div className="mt-3">
              <Alert tone="warning" role="alert">
                {error}
              </Alert>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle level={2} hint="Profiles already used on this device.">
              On this device
            </SectionTitle>
            {profiles.length === 0 ? (
              <p className="text-sm text-[var(--lr-ink-soft)]">No profiles yet — create the first one.</p>
            ) : (
              <ul className="space-y-2">
                {profiles.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--lr-rule)] p-3">
                    <div>
                      <p className="font-bold">{p.displayName}</p>
                      <p className="text-xs text-[var(--lr-ink-soft)]">@{p.username} · {p.role}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTab('signin');
                        setForm((current) => ({ ...current, username: p.username }));
                      }}
                    >
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle level={2}>What we do not collect</SectionTitle>
            <ul className="space-y-1.5 text-sm text-[var(--lr-ink-soft)]">
              <li>No email address, no phone number, no birth date.</li>
              <li>No advertising or third-party analytics.</li>
              <li>Speech recognition runs inside the browser — audio is never uploaded.</li>
              <li>Reading history stays in this app's own database and can be deleted with the profile.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="accent">Minimal data by design</Pill>
              <Pill>{profiles.length} profile{profiles.length === 1 ? '' : 's'} on this device</Pill>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ProfileSwitcher({ className }) {
  const { profiles, profile } = useAuth();
  if (!profiles?.length) return null;
  return (
    <span className={className}>
      <Pill>
        {profile ? profile.displayName : `${profiles.length} profile${profiles.length === 1 ? '' : 's'} on this device`}
      </Pill>
    </span>
  );
}
