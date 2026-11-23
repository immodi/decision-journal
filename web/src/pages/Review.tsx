import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDecision, useDecisions } from '../hooks/useDecisions';
import { formatDate, PREDICTION_RESULTS, REASONING_RATINGS } from '../lib/decisions';
import {
  buttonGhost,
  buttonPrimary,
  card,
  chipOff,
  chipOn,
  field,
  hint,
  input,
  mutedText,
  sectionTitle,
  textarea,
} from '../components/ui';
import type { PredictionResult, ReasoningRating } from '../types';

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { decision, loading } = useDecision(id);
  const { review } = useDecisions();

  const [outcome, setOutcome] = useState('');
  const [predictionResult, setPredictionResult] = useState<PredictionResult | ''>('');
  const [reasoningRating, setReasoningRating] = useState<ReasoningRating | ''>('');
  const [lesson, setLesson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className={`${mutedText} pt-10 text-center`}>Loading…</p>;
  if (!decision) return <p className={`${mutedText} pt-10 text-center`}>That decision no longer exists.</p>;
  if (decision.status !== 'open') return <Navigate to={`/decisions/${decision.id}`} replace />;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!id) return;
    if (!outcome.trim() || !predictionResult || !reasoningRating) {
      setError('Outcome, prediction result and reasoning rating are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await review(id, {
        outcome: outcome.trim(),
        predictionResult,
        reasoningRating,
        lesson: lesson.trim(),
      });
      navigate(`/decisions/${id}`);
    } catch (nextError) {
      console.error(nextError);
      setError('Could not save the review. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Review</h1>
        <p className={mutedText}>{decision.title}</p>
      </header>

      <div className={`${card} mb-5 grid gap-3 border-l-2 border-l-accent p-5`}>
        <div className="grid gap-0.5">
          <span className={sectionTitle}>What you predicted on {formatDate(decision.createdAt)}</span>
          <span className="text-base italic leading-relaxed">“{decision.prediction}”</span>
        </div>
        <div className="grid gap-0.5">
          <span className={sectionTitle}>Confidence at the time</span>
          <span className="text-sm">{decision.confidence}%</span>
        </div>
      </div>

      <form className={`${card} grid gap-5 p-6`} onSubmit={submit}>
        <label className={field}>
          What actually happened
          <textarea
            className={textarea}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            autoFocus
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Did the prediction come true?</span>
          <div className="flex flex-wrap gap-2">
            {PREDICTION_RESULTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={predictionResult === value ? chipOn : chipOff}
                onClick={() => setPredictionResult(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">
            Was the reasoning sound, given what was known then?
          </span>
          <span className={hint}>Judge the process, not the outcome.</span>
          <div className="flex flex-wrap gap-2">
            {REASONING_RATINGS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={reasoningRating === value ? chipOn : chipOff}
                onClick={() => setReasoningRating(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className={field}>
          Lesson
          <span className={hint}>Optional, one line.</span>
          <input
            type="text"
            className={input}
            value={lesson}
            onChange={(event) => setLesson(event.target.value)}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <p className={`${mutedText} rounded-xl bg-surface-2 px-4 py-3`}>
          Saving closes this decision for good: the entry becomes read-only and cannot be deleted.
        </p>

        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <button type="button" className={buttonGhost} onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={buttonPrimary} disabled={busy}>
            {busy ? 'Saving…' : 'Save review'}
          </button>
        </div>
      </form>
    </div>
  );
}
