import { Link } from 'react-router-dom';
import { formatDate, isOverdue } from '../lib/decisions';
import {
  buttonPrimarySmall,
  buttonSecondarySmall,
  pillDue,
  pillOpen,
  pillReviewed,
} from '../components/ui';
import type { Decision } from '../types';

interface DecisionCardProps {
  decision: Decision;
}

export default function DecisionCard({ decision }: DecisionCardProps) {
  const overdue = isOverdue(decision);
  const reviewed = decision.status === 'reviewed';
  const statusClass = reviewed ? pillReviewed : overdue ? pillDue : pillOpen;

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/decisions/${decision.id}`} className="block text-ink hover:no-underline">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug">{decision.title}</h3>
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            {decision.confidence}%
          </span>
        </div>

        <p className="mt-1.5 text-sm italic text-muted">“{decision.prediction}”</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={statusClass}>
            {reviewed ? 'Reviewed' : overdue ? 'Due' : 'Open'}
          </span>
          {decision.postponedAt && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
              Postponed
            </span>
          )}
          {decision.state && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
              {decision.state}
            </span>
          )}
          <span className="text-muted">
            {reviewed
              ? `Reviewed ${formatDate(decision.review?.reviewedAt)}`
              : `Review ${formatDate(decision.reviewDate)}`}
          </span>
        </div>
      </Link>

      {overdue && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Link to={`/decisions/${decision.id}/review`} className={buttonPrimarySmall}>
            Review now
          </Link>
          {!decision.postponedAt && (
            <Link to={`/decisions/${decision.id}?postpone=1`} className={buttonSecondarySmall}>
              Postpone
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
