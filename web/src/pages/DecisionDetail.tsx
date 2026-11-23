import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Timestamp } from 'firebase/firestore';
import { useDecision, useDecisions } from '../hooks/useDecisions';
import {
  dateInputValue,
  dateFromInput,
  formatDate,
  isOverdue,
  inDays,
  PREDICTION_RESULTS,
  QUICK_DAYS,
  REASONING_RATINGS,
  STATES,
} from '../lib/decisions';
import type { DecisionState } from '../types';

const labelOf = (
  pairs: ReadonlyArray<readonly [string, string]>,
  value: string | null | undefined,
): string => pairs.find(([key]) => key === value)?.[1] ?? value ?? '—';

interface DetailFieldsProps {
  decision: import('../types').Decision;
}

function DetailFields({ decision }: DetailFieldsProps) {
  return (
    <dl className="detail-grid">
      <div className="detail-row">
        <dt>Prediction</dt>
        <dd>{decision.prediction}</dd>
      </div>
      <div className="detail-row">
        <dt>Confidence</dt>
        <dd>{decision.confidence}%</dd>
      </div>
      {decision.options.length > 0 && (
        <div className="detail-row">
          <dt>Options considered</dt>
          <dd>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {decision.options.map((option) => <li key={option}>{option}</li>)}
            </ul>
          </dd>
        </div>
      )}
      {decision.reasoning && (
        <div className="detail-row">
          <dt>Reasoning</dt>
          <dd>{decision.reasoning}</dd>
        </div>
      )}
      <div className="detail-row">
        <dt>State</dt>
        <dd>{decision.state || '—'}</dd>
      </div>
      {decision.tags.length > 0 && (
        <div className="detail-row">
          <dt>Tags</dt>
          <dd>{decision.tags.join(', ')}</dd>
        </div>
      )}
      <div className="detail-row">
        <dt>Review date</dt>
        <dd>
          {formatDate(decision.reviewDate)}
          {decision.postponedAt && (
            <span className="muted small"> · postponed once on {formatDate(decision.postponedAt)}</span>
          )}
        </dd>
      </div>
      <div className="detail-row">
        <dt>Created</dt>
        <dd>{formatDate(decision.createdAt)}</dd>
      </div>
    </dl>
  );
}

interface Draft {
  title: string;
  options: string;
  reasoning: string;
  prediction: string;
  confidence: number;
  state: DecisionState;
  tags: string;
}

export default function DecisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { decision, loading } = useDecision(id);
  const { update, postpone, remove } = useDecisions();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [postponing, setPostponing] = useState(false);
  const [postponeDate, setPostponeDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="muted">Loading…</p>;
  if (!decision) {
    return (
      <>
        <h1>Decision not found</h1>
        <button className="button" type="button" onClick={() => navigate('/')}>Back to Home</button>
      </>
    );
  }

  const overdue = isOverdue(decision);
  const reviewed = decision.status === 'reviewed';
  const alreadyPostponed = Boolean(decision.postponedAt);
  // Keep a non-null alias for use inside async closures below.
  const item = decision;

  const startEdit = (): void => {
    setError(null);
    setDraft({
      title: decision.title,
      options: decision.options.join('\n'),
      reasoning: decision.reasoning,
      prediction: decision.prediction,
      confidence: decision.confidence,
      state: decision.state,
      tags: decision.tags.join(', '),
    });
  };

  async function saveEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft) return;
    if (!draft.title.trim() || !draft.prediction.trim()) {
      setError('Title and prediction are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await update(item.id, {
        title: draft.title.trim(),
        prediction: draft.prediction.trim(),
        options: draft.options.split('\n').map((value) => value.trim()).filter(Boolean),
        reasoning: draft.reasoning.trim(),
        confidence: draft.confidence,
        state: draft.state,
        tags: draft.tags.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
      });
      setDraft(null);
    } catch (nextError) {
      console.error(nextError);
      setError('Could not save your changes. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function postponeTo(value: Timestamp): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await postpone(item.id, value);
      setPostponing(false);
    } catch (nextError) {
      console.error(nextError);
      setError('Could not postpone the review. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function destroy(): Promise<void> {
    if (!window.confirm('Delete this decision? A reviewed decision can no longer be deleted.')) return;
    setBusy(true);
    setError(null);
    try {
      await remove(item.id);
      navigate('/');
    } catch (nextError) {
      console.error(nextError);
      setError('Could not delete this decision. Try again.');
      setBusy(false);
    }
  }

  const confirmPostpone = (): void => {
    const parsed = dateFromInput(postponeDate);
    if (parsed) void postponeTo(parsed);
  };

  return (
    <>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>{decision.title}</h1>
        <span className={`pill ${reviewed ? 'reviewed' : overdue ? 'overdue' : 'open'}`}>
          {reviewed ? 'Reviewed' : overdue ? 'Due for review' : 'Open'}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      {reviewed ? (
        <>
          <DetailFields decision={decision} />
          <h2>Review</h2>
          <dl className="detail-grid review-block">
            <div className="detail-row">
              <dt>What happened</dt>
              <dd>{decision.review?.outcome}</dd>
            </div>
            <div className="detail-row">
              <dt>Prediction came true</dt>
              <dd>{labelOf(PREDICTION_RESULTS, decision.review?.predictionResult)}</dd>
            </div>
            <div className="detail-row">
              <dt>Reasoning, given what was known then</dt>
              <dd>{labelOf(REASONING_RATINGS, decision.review?.reasoningRating)}</dd>
            </div>
            {decision.review?.lesson && (
              <div className="detail-row">
                <dt>Lesson</dt>
                <dd>{decision.review.lesson}</dd>
              </div>
            )}
            <div className="detail-row">
              <dt>Reviewed</dt>
              <dd>{formatDate(decision.review?.reviewedAt)}</dd>
            </div>
          </dl>
          <p className="muted small">Reviewed entries are permanent: they cannot be edited or deleted.</p>
        </>
      ) : draft ? (
        <form className="stack" onSubmit={saveEdit}>
          <label className="field">
            Title
            <input
              type="text"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label className="field">
            Options considered
            <span className="hint">One per line.</span>
            <textarea
              value={draft.options}
              onChange={(event) => setDraft({ ...draft, options: event.target.value })}
            />
          </label>
          <label className="field">
            Reasoning
            <textarea
              value={draft.reasoning}
              onChange={(event) => setDraft({ ...draft, reasoning: event.target.value })}
            />
          </label>
          <label className="field">
            Prediction
            <input
              type="text"
              value={draft.prediction}
              onChange={(event) => setDraft({ ...draft, prediction: event.target.value })}
            />
          </label>
          <label className="field">
            Confidence: {draft.confidence}%
            <span className="range-row">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={draft.confidence}
                onChange={(event) => setDraft({ ...draft, confidence: Number(event.target.value) })}
              />
            </span>
          </label>
          <div className="field">
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>State</span>
            <div className="chips" style={{ marginTop: '0.35rem' }}>
              {STATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip ${draft.state === value ? 'selected' : ''}`}
                  onClick={() => setDraft({ ...draft, state: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Tags
            <span className="hint">Comma separated. The review date cannot be changed here.</span>
            <input
              type="text"
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            />
          </label>
          <div className="actions end">
            <button type="button" className="button" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <DetailFields decision={decision} />

          {postponing && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <strong>Postpone this review</strong>
              <p className="muted small" style={{ marginTop: '0.25rem' }}>
                The review date can be moved once. Choose the new date.
              </p>
              <div className="row wrap" style={{ marginTop: '0.5rem' }}>
                {QUICK_DAYS.map(([days, label]) => (
                  <button
                    key={days}
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => void postponeTo(inDays(days))}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  value={postponeDate}
                  onChange={(event) => setPostponeDate(event.target.value)}
                  style={{ width: 'auto' }}
                />
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || !postponeDate}
                  onClick={confirmPostpone}
                >
                  Postpone
                </button>
                <button type="button" className="button" onClick={() => setPostponing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="actions">
            {overdue && (
              <button
                type="button"
                className="button primary"
                onClick={() => navigate(`/decisions/${decision.id}/review`)}
              >
                Review now
              </button>
            )}
            <button type="button" className="button" onClick={startEdit} disabled={busy}>
              Edit
            </button>
            {overdue && !alreadyPostponed && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setPostponing(true);
                  setPostponeDate(dateInputValue(inDays(30)));
                }}
              >
                Postpone
              </button>
            )}
            <button type="button" className="button danger" onClick={() => void destroy()} disabled={busy}>
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
