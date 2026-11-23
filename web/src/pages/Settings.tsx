import { useEffect, useState, type FormEvent } from 'react';
import { signOut } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import { useDecisions } from '../hooks/useDecisions';
import { useSettings } from '../hooks/useSettings';
import {
  buttonPrimary,
  buttonSecondary,
  card,
  field,
  hint,
  input,
  mutedText,
} from '../components/ui';

// Firestore Timestamps do not survive JSON.stringify usefully, so export ISO strings.
function serialise(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, serialise(entry)]),
    );
  }
  return value;
}

export default function Settings() {
  const { settings, save } = useSettings();
  const { decisions } = useDecisions();

  const [reminderTime, setReminderTime] = useState(settings.reminderTime);
  const [defaultReviewDays, setDefaultReviewDays] = useState(settings.defaultReviewDays);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReminderTime(settings.reminderTime);
    setDefaultReviewDays(settings.defaultReviewDays);
  }, [settings.reminderTime, settings.defaultReviewDays]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await save({ reminderTime, defaultReviewDays });
      setMessage('Settings saved.');
    } catch (nextError) {
      console.error(nextError);
      setError('Could not save settings. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function exportJson(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      decisions: decisions.map(serialise),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `decision-journal-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className={mutedText}>Reminders, defaults and your data.</p>
      </header>

      <form className={`${card} grid gap-5 p-6`} onSubmit={submit}>
        <label className={field}>
          Reminder time
          <span className={hint}>
            Used by the Android daily check. The web client shows a due count instead of notifying.
          </span>
          <input
            type="time"
            className={input}
            value={reminderTime}
            onChange={(event) => setReminderTime(event.target.value)}
          />
        </label>

        <label className={field}>
          Default review period
          <span className={hint}>Days from today when creating a decision.</span>
          <input
            type="number"
            min="1"
            max="365"
            className={input}
            value={defaultReviewDays}
            onChange={(event) => setDefaultReviewDays(Number(event.target.value))}
          />
        </label>

        {message && <p className={mutedText}>{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end border-t border-line pt-5">
          <button type="submit" className={buttonPrimary} disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      <section className={`${card} p-6`}>
        <h2 className="text-lg font-semibold tracking-tight">Data</h2>
        <p className={`${mutedText} mt-1`}>
          The free plan has no managed backups. Export a copy now and then.
        </p>
        <button
          type="button"
          className={`${buttonSecondary} mt-4`}
          onClick={exportJson}
          disabled={decisions.length === 0}
        >
          Export all data as JSON
        </button>
      </section>

      <section className={`${card} p-6`}>
        <h2 className="text-lg font-semibold tracking-tight">Account</h2>
        <p className={`${mutedText} mt-1`}>
          Signed in as {auth.currentUser?.email ?? 'unknown'}.
        </p>
        <button
          type="button"
          className={`${buttonSecondary} mt-4`}
          onClick={() => void signOut(auth)}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
