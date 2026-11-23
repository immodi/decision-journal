import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDecisions } from '../hooks/useDecisions';
import { isOverdue, SUGGESTED_TAGS, sortByReviewDate } from '../lib/decisions';
import { buttonPrimary, mutedText, sectionTitle, select } from '../components/ui';
import type { Decision, DecisionStatus } from '../types';
import DecisionCard from '../components/DecisionCard';

type StatusFilter = 'all' | DecisionStatus;

export default function Home() {
  const { decisions, loading, error } = useDecisions();
  const [tag, setTag] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  if (loading) return <p className={`${mutedText} pt-10 text-center`}>Loading decisions…</p>;
  if (error) {
    return (
      <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
        Could not load your decisions. Check your connection and try again.
      </p>
    );
  }

  const tags = [...new Set([...SUGGESTED_TAGS, ...decisions.flatMap((entry) => entry.tags)])];
  const matches = (entry: Decision): boolean => (
    (tag === 'all' || entry.tags.includes(tag))
    && (status === 'all' || entry.status === status)
  );

  const due = sortByReviewDate(decisions.filter(isOverdue)).filter(matches);
  const recent = decisions.filter(matches).slice(0, 20);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className={mutedText}>Due first, then the latest.</p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Filter by tag"
            className={`${select} w-32`}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">All tags</option>
            {tags.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select
            aria-label="Filter by status"
            className={`${select} w-32`}
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </header>

      {decisions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
            No decisions yet. Record one while it is fresh: a title, a prediction,
            how confident you are, and when to look at it again.
          </p>
          <Link to="/new" className={`${buttonPrimary} mt-5`}>
            Record your first decision
          </Link>
        </div>
      )}

      {status !== 'reviewed' && due.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className={sectionTitle}>Due for review</h2>
            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
              {due.length}
            </span>
          </div>
          <div className="grid gap-3">
            {due.map((entry) => <DecisionCard key={entry.id} decision={entry} />)}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className={`${sectionTitle} mb-3`}>
            {status === 'reviewed' ? 'Reviewed' : 'Recent'}
          </h2>
          <div className="grid gap-3">
            {recent.map((entry) => <DecisionCard key={entry.id} decision={entry} />)}
          </div>
        </section>
      )}

      {decisions.length > 0 && recent.length === 0 && (
        <p className={`${mutedText} py-10 text-center`}>Nothing matches those filters.</p>
      )}
    </>
  );
}
