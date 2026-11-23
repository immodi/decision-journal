import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleSignInEnabled } from '../firebase';

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
    <div className="auth-shell">
      <h1>Decision Journal</h1>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : registering ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {googleSignInEnabled && (
        <>
          <p className="divider">or</p>
          <button className="button" type="button" onClick={google} disabled={busy} style={{ width: '100%' }}>
            Continue with Google
          </button>
        </>
      )}

      <p className="auth-switch">
        {registering ? 'Already have an account? ' : 'New here? '}
        <button
          type="button"
          className="button plain"
          onClick={() => {
            setMode(registering ? 'signin' : 'register');
            setError(null);
          }}
        >
          {registering ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
  );
}
