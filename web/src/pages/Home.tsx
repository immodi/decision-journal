import { useState } from 'react';
import { useDecisions } from '../hooks/useDecisions';
import { isOverdue, SUGGESTED_TAGS, sortByReviewDate } from '../lib/decisions';
import type { Decision, DecisionStatus } from '../types';
import DecisionCard from '../components/DecisionCard';

type StatusFilter = 'all' | DecisionStatus;

export default function Home() {
  const { decisions, loading, error } = useDecisions();
  const [tag, setTag] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  if (loading) return <p className="muted">Loading decisions…</p>;
  if (error) return <p className="error">Could not load your decisions. Check your connection and try again.</p>;

  const tags = [...new Set([...SUGGESTED_TAGS, ...decisions.flatMap((entry) => entry.tags)])];
  const matches = (entry: Decision): boolean => (
    (tag === 'all' || entry.tags.includes(tag))
    && (status === 'all' || entry.status === status)
  );

  const due = sortByReviewDate(decisions.filter(isOverdue)).filter(matches);
  const recent = decisions.filter(matches).slice(0, 20);

  return (
    <>
      <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Home</h1>
        <div className="row">
          <label className="field" style={{ fontWeight: 400 }}>
            <span className="visually-hidden">Tag</span>
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">All tags</option>
              {tags.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="field" style={{ fontWeight: 400 }}>
            <span className="visually-hidden">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
        </div>
      </div>

      {decisions.length === 0 && (
        <p className="notice">
          No decisions yet. Record one while it is fresh: a title, a prediction,
          how confident you are, and when to look at it again.
        </p>
      )}

      {status !== 'reviewed' && due.length > 0 && (
        <>
          <h2>Due for review</h2>
          <div className="cards">
            {due.map((entry) => <DecisionCard key={entry.id} decision={entry} />)}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2>{status === 'reviewed' ? 'Reviewed' : 'Recent'}</h2>
          <div className="cards">
            {recent.map((entry) => <DecisionCard key={entry.id} decision={entry} />)}
          </div>
        </>
      )}

      {decisions.length > 0 && recent.length === 0 && (
        <p className="muted">Nothing matches those filters.</p>
      )}
    </>
  );
}
