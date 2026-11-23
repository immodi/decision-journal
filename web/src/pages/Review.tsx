import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDecision, useDecisions } from '../hooks/useDecisions';
import { formatDate, PREDICTION_RESULTS, REASONING_RATINGS } from '../lib/decisions';
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

  if (loading) return <p className="muted">Loading…</p>;
  if (!decision) return <p className="muted">That decision no longer exists.</p>;
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
    <>
      <h1>Review: {decision.title}</h1>

      <dl className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="detail-row">
          <dt>What you predicted on {formatDate(decision.createdAt)}</dt>
          <dd style={{ fontSize: '1.05rem' }}>“{decision.prediction}”</dd>
        </div>
        <div className="detail-row" style={{ marginTop: '0.5rem' }}>
          <dt>Confidence at the time</dt>
          <dd>{decision.confidence}%</dd>
        </div>
      </dl>

      <form className="stack" onSubmit={submit}>
        <label className="field">
          What actually happened
          <textarea
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            autoFocus
          />
        </label>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Did the prediction come true?</span>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            {PREDICTION_RESULTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${predictionResult === value ? 'selected' : ''}`}
                onClick={() => setPredictionResult(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Was the reasoning sound, given what was known then?
          </span>
          <span className="hint">Judge the process, not the outcome.</span>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            {REASONING_RATINGS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${reasoningRating === value ? 'selected' : ''}`}
                onClick={() => setReasoningRating(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          Lesson
          <span className="hint">Optional, one line.</span>
          <input
            type="text"
            value={lesson}
            onChange={(event) => setLesson(event.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <p className="muted small">
          Saving closes this decision for good: the entry becomes read-only and cannot be deleted.
        </p>

        <div className="actions end">
          <button type="button" className="button" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save review'}
          </button>
        </div>
      </form>
    </>
  );
}
