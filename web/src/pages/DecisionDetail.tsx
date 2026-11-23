import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import {
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  buttonSecondarySmall,
  card,
  chipOff,
  chipOn,
  dateInput,
  field,
  hint,
  input,
  mutedText,
  pillDue,
  pillOpen,
  pillReviewed,
  sectionTitle,
  textarea,
} from '../components/ui';
import type { Decision, DecisionState } from '../types';

const labelOf = (
  pairs: ReadonlyArray<readonly [string, string]>,
  value: string | null | undefined,
): string => pairs.find(([key]) => key === value)?.[1] ?? value ?? '—';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className={sectionTitle}>{label}</dt>
      <dd className="m-0 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function DetailFields({ decision }: { decision: Decision }) {
  return (
    <dl className={`${card} grid gap-4 p-5`}>
      <Row label="Prediction">{decision.prediction}</Row>
      <Row label="Confidence">{decision.confidence}%</Row>
      {decision.options.length > 0 && (
        <Row label="Options considered">
          <ul className="m-0 list-disc pl-5">
            {decision.options.map((option) => <li key={option}>{option}</li>)}
          </ul>
        </Row>
      )}
      {decision.reasoning && <Row label="Reasoning">{decision.reasoning}</Row>}
      <Row label="State">{decision.state || '—'}</Row>
      {decision.tags.length > 0 && <Row label="Tags">{decision.tags.join(', ')}</Row>}
      <Row label="Review date">
        {formatDate(decision.reviewDate)}
        {decision.postponedAt && (
          <span className="text-muted"> · postponed once on {formatDate(decision.postponedAt)}</span>
        )}
      </Row>
      <Row label="Created">{formatDate(decision.createdAt)}</Row>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsPostpone = searchParams.get('postpone') === '1';

  // Arriving from the "Postpone" action on a card: open the panel immediately.
  useEffect(() => {
    if (!wantsPostpone || !decision || decision.status !== 'open') return;
    setPostponing(true);
    setPostponeDate(dateInputValue(inDays(30)));
    const next = new URLSearchParams(searchParams);
    next.delete('postpone');
    setSearchParams(next, { replace: true });
  }, [wantsPostpone, decision, searchParams, setSearchParams]);

  if (loading) return <p className={`${mutedText} pt-10 text-center`}>Loading…</p>;
  if (!decision) {
    return (
      <div className="pt-10 text-center">
        <h1 className="text-xl font-semibold">Decision not found</h1>
        <button className={`${buttonSecondary} mt-4`} type="button" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    );
  }

  const overdue = isOverdue(decision);
  const reviewed = decision.status === 'reviewed';
  const alreadyPostponed = Boolean(decision.postponedAt);
  // Keep a non-null alias for use inside async closures below.
  const item = decision;
  const statusClass = reviewed ? pillReviewed : overdue ? pillDue : pillOpen;

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
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{decision.title}</h1>
          <p className={mutedText}>Recorded {formatDate(decision.createdAt)}</p>
        </div>
        <span className={statusClass}>
          {reviewed ? 'Reviewed' : overdue ? 'Due for review' : 'Open'}
        </span>
      </header>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {reviewed ? (
        <>
          <DetailFields decision={decision} />

          <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight">Review</h2>
          <dl className={`${card} grid gap-4 border-l-2 border-l-accent p-5`}>
            <Row label="What happened">{decision.review?.outcome}</Row>
            <Row label="Prediction came true">
              {labelOf(PREDICTION_RESULTS, decision.review?.predictionResult)}
            </Row>
            <Row label="Reasoning, given what was known then">
              {labelOf(REASONING_RATINGS, decision.review?.reasoningRating)}
            </Row>
            {decision.review?.lesson && <Row label="Lesson">{decision.review.lesson}</Row>}
            <Row label="Reviewed">{formatDate(decision.review?.reviewedAt)}</Row>
          </dl>

          <p className={`${mutedText} mt-4`}>
            Reviewed entries are permanent: they cannot be edited or deleted.
          </p>
        </>
      ) : draft ? (
        <form className={`${card} grid gap-5 p-6`} onSubmit={saveEdit}>
          <label className={field}>
            Title
            <input
              type="text"
              className={input}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <label className={field}>
            Options considered
            <span className={hint}>One per line.</span>
            <textarea
              className={textarea}
              value={draft.options}
              onChange={(event) => setDraft({ ...draft, options: event.target.value })}
            />
          </label>

          <label className={field}>
            Reasoning
            <textarea
              className={textarea}
              value={draft.reasoning}
              onChange={(event) => setDraft({ ...draft, reasoning: event.target.value })}
            />
          </label>

          <label className={field}>
            Prediction
            <input
              type="text"
              className={input}
              value={draft.prediction}
              onChange={(event) => setDraft({ ...draft, prediction: event.target.value })}
            />
          </label>

          <label className={field}>
            Confidence: {draft.confidence}%
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={draft.confidence}
              onChange={(event) => setDraft({ ...draft, confidence: Number(event.target.value) })}
              className="w-full accent-accent"
            />
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-medium">State</span>
            <div className="flex flex-wrap gap-2">
              {STATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={draft.state === value ? chipOn : chipOff}
                  onClick={() => setDraft({ ...draft, state: value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <label className={field}>
            Tags
            <span className={hint}>Comma separated. The review date cannot be changed here.</span>
            <input
              type="text"
              className={input}
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <button type="button" className={buttonGhost} onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={buttonPrimary} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <DetailFields decision={decision} />

          {postponing && (
            <div className={`${card} mt-4 grid gap-3 p-4`}>
              <div>
                <strong className="text-sm font-semibold">Postpone this review</strong>
                <p className={`${mutedText} mt-0.5`}>
                  The review date can be moved once. Choose the new date.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_DAYS.map(([days, label]) => (
                  <button
                    key={days}
                    type="button"
                    className={chipOff}
                    disabled={busy}
                    onClick={() => void postponeTo(inDays(days))}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  className={dateInput}
                  value={postponeDate}
                  onChange={(event) => setPostponeDate(event.target.value)}
                />
                <button
                  type="button"
                  className={buttonSecondarySmall}
                  disabled={busy || !postponeDate}
                  onClick={confirmPostpone}
                >
                  Postpone
                </button>
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => setPostponing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {overdue && (
              <button
                type="button"
                className={buttonPrimary}
                onClick={() => navigate(`/decisions/${decision.id}/review`)}
              >
                Review now
              </button>
            )}
            <button type="button" className={buttonSecondary} onClick={startEdit} disabled={busy}>
              Edit
            </button>
            {overdue && !alreadyPostponed && (
              <button
                type="button"
                className={buttonSecondary}
                disabled={busy}
                onClick={() => {
                  setPostponing(true);
                  setPostponeDate(dateInputValue(inDays(30)));
                }}
              >
                Postpone
              </button>
            )}
            <button type="button" className={buttonDanger} onClick={() => void destroy()} disabled={busy}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
