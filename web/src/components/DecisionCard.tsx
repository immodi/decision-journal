import { Link } from 'react-router-dom';
import { formatDate, isOverdue } from '../lib/decisions';
import type { Decision } from '../types';

interface DecisionCardProps {
  decision: Decision;
}

export default function DecisionCard({ decision }: DecisionCardProps) {
  const overdue = isOverdue(decision);
  const reviewed = decision.status === 'reviewed';

  return (
    <div className="card decision-card">
      <Link to={`/decisions/${decision.id}`} className="decision-card-link">
        <div className="decision-card-head">
          <h3>{decision.title}</h3>
          <span className="confidence">{decision.confidence}%</span>
        </div>
        <p className="prediction">“{decision.prediction}”</p>
        <div className="card-meta">
          <span className={`pill ${reviewed ? 'reviewed' : overdue ? 'overdue' : 'open'}`}>
            {reviewed ? 'Reviewed' : overdue ? 'Due' : 'Open'}
          </span>
          {decision.postponedAt && <span className="pill subtle">Postponed</span>}
          {decision.state && <span className="pill subtle">{decision.state}</span>}
          <span className="muted">
            {reviewed
              ? `Reviewed ${formatDate(decision.review?.reviewedAt)}`
              : `Review ${formatDate(decision.reviewDate)}`}
          </span>
        </div>
      </Link>

      {overdue && (
        <div className="card-actions">
          <Link to={`/decisions/${decision.id}/review`} className="button primary">Review now</Link>
          {!decision.postponedAt && (
            <Link to={`/decisions/${decision.id}`} className="button">Postpone</Link>
          )}
        </div>
      )}
    </div>
  );
}
