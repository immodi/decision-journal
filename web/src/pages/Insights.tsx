import { useDecisions } from '../hooks/useDecisions';
import { isOverdue, STATES } from '../lib/decisions';
import type { Decision, PredictionResult } from '../types';

const BUCKETS: Array<readonly [number, number, number]> = [
  [0, 49, 25],
  [50, 59, 55],
  [60, 69, 65],
  [70, 79, 75],
  [80, 89, 85],
  [90, 100, 95],
];

const SCORES: Record<PredictionResult, number> = { yes: 1, partly: 0.5, no: 0 };

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function scoreOf(decision: Decision): number {
  const result = decision.review?.predictionResult;
  return result ? SCORES[result] : 0;
}

interface StatProps {
  label: string;
  value: string | number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

interface CalibrationRow {
  label: string;
  midpoint: number;
  count: number;
  rate: number;
}

export default function Insights() {
  const { decisions, loading, error } = useDecisions();

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error.message}</p>;

  const open = decisions.filter((entry) => entry.status === 'open');
  const reviewed = decisions.filter((entry) => entry.status === 'reviewed');
  const overdue = open.filter(isOverdue);
  const postponed = decisions.filter((entry) => entry.postponedAt);
  const enough = reviewed.length >= 5;

  // Calibration: hit rate per confidence band, buckets under 3 decisions hidden.
  const calibration = BUCKETS
    .map(([min, max, midpoint]): CalibrationRow => {
      const items = reviewed.filter((entry) => (
        entry.confidence >= min && entry.confidence <= max
      ));
      const hits = items.reduce((total, entry) => total + scoreOf(entry), 0);
      return {
        label: min === 0 ? '0–49' : `${min}–${max}`,
        midpoint,
        count: items.length,
        rate: items.length ? hits / items.length : 0,
      };
    })
    .filter((bucket) => bucket.count >= 3);

  const byState = STATES.map((state) => {
    const items = reviewed.filter((entry) => entry.state === state);
    const sound = items.filter((entry) => entry.review?.reasoningRating === 'sound');
    return { state, count: items.length, soundShare: items.length ? sound.length / items.length : 0 };
  }).filter((row) => row.count > 0);

  const tagNames = [...new Set(reviewed.flatMap((entry) => entry.tags))].sort();
  const byTag = tagNames.map((tag) => {
    const items = reviewed.filter((entry) => entry.tags.includes(tag));
    const sound = items.filter((entry) => entry.review?.reasoningRating === 'sound');
    return { tag, count: items.length, soundShare: items.length ? sound.length / items.length : 0 };
  });

  return (
    <>
      <h1>Insights</h1>

      <div className="stat-grid">
        <Stat label="Open" value={open.length} />
        <Stat label="Reviewed" value={reviewed.length} />
        <Stat label="Overdue" value={overdue.length} />
        <Stat
          label="Postponed"
          value={`${postponed.length}${decisions.length ? ` · ${percent(postponed.length / decisions.length)}` : ''}`}
        />
      </div>

      {!enough && (
        <p className="notice" style={{ marginTop: '1.25rem' }}>
          Not enough data yet: {reviewed.length} of 5 reviewed decisions.
          The statistics appear once five reviews are in.
        </p>
      )}

      {enough && (
        <>
          <h2>Calibration</h2>
          <p className="muted small">
            If your confidence is honest, each row lands near its midpoint.
            Buckets with fewer than three decisions are hidden.
          </p>
          {calibration.length === 0 ? (
            <p className="muted">No confidence band has three reviewed decisions yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Confidence</th>
                  <th className="numeric">Midpoint</th>
                  <th className="numeric">Decisions</th>
                  <th className="numeric">Hit rate</th>
                  <th className="numeric">Gap</th>
                </tr>
              </thead>
              <tbody>
                {calibration.map((bucket) => (
                  <tr key={bucket.label}>
                    <td>{bucket.label}</td>
                    <td className="numeric">{bucket.midpoint}%</td>
                    <td className="numeric">{bucket.count}</td>
                    <td className="numeric">{percent(bucket.rate)}</td>
                    <td className="numeric">
                      {percent(bucket.rate - bucket.midpoint / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Reasoning by state</h2>
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th className="numeric">Decisions</th>
                <th className="numeric">Sound</th>
              </tr>
            </thead>
            <tbody>
              {byState.map((row) => (
                <tr key={row.state}>
                  <td>{row.state}</td>
                  <td className="numeric">{row.count}</td>
                  <td className="numeric">{percent(row.soundShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>By tag</h2>
          {byTag.length === 0 ? (
            <p className="muted">No tags on reviewed decisions yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th className="numeric">Decisions</th>
                  <th className="numeric">Sound</th>
                </tr>
              </thead>
              <tbody>
                {byTag.map((row) => (
                  <tr key={row.tag}>
                    <td>{row.tag}</td>
                    <td className="numeric">{row.count}</td>
                    <td className="numeric">{percent(row.soundShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
