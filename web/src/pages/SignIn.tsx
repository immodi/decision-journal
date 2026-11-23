import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleSignInEnabled } from '../firebase';
import { buttonPrimary, buttonSecondary, card, field, input } from '../components/ui';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/missing-password': 'Enter a password.',
  'auth/weak-password': 'Use at least six characters.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/operation-not-allowed': 'This sign-in method is not available right now.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'The browser blocked the sign-in window.',
  'auth/unauthorized-domain': 'Google sign-in is not available on this site yet.',
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
};

function messageFor(error: unknown): string {
  if (error instanceof FirebaseError && MESSAGES[error.code]) return MESSAGES[error.code];
  return 'Sign-in failed. Please try again.';
}

type Mode = 'signin' | 'register';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (registering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (nextError) {
      console.error(nextError);
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function google(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (nextError) {
      console.error(nextError);
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icon.svg" alt="" className="h-16 w-16 rounded-2xl shadow-md" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Decision Journal</h1>
          <p className="mt-1.5 max-w-[19rem] text-sm text-muted">
            Record the decision now. Judge the reasoning later.
          </p>
        </div>

        <form className={`${card} grid gap-4 p-6`} onSubmit={submit}>
          <label className={field}>
            Email
            <input
              type="email"
              autoComplete="email"
              className={input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={field}>
            Password
            <input
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              className={input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button className={`${buttonPrimary} w-full`} type="submit" disabled={busy}>
            {busy ? 'Working…' : registering ? 'Create account' : 'Sign in'}
          </button>

          {googleSignInEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <button
                className={`${buttonSecondary} w-full`}
                type="button"
                onClick={google}
                disabled={busy}
              >
                Continue with Google
              </button>
            </>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {registering ? 'Already have an account? ' : 'New here? '}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => {
              setMode(registering ? 'signin' : 'register');
              setError(null);
            }}
          >
            {registering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
