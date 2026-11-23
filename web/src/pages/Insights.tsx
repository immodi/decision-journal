import { useDecisions } from '../hooks/useDecisions';
import { isOverdue, STATES } from '../lib/decisions';
import { card, mutedText, sectionTitle } from '../components/ui';
import type { ReactNode } from 'react';
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-2xl font-semibold tabular-nums text-accent">{value}</div>
      <div className={`${sectionTitle} mt-0.5`}>{label}</div>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-line">
      {children}
    </tr>
  );
}

function Th({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted ${numeric ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td className={`border-t border-line px-4 py-2.5 ${numeric ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
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

  if (loading) return <p className={`${mutedText} pt-10 text-center`}>Loading…</p>;
  if (error) {
    return (
      <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
        Could not load your decisions. Check your connection and try again.
      </p>
    );
  }

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
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className={mutedText}>What your reviews say about your judgement.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open" value={open.length} />
        <Stat label="Reviewed" value={reviewed.length} />
        <Stat label="Overdue" value={overdue.length} />
        <Stat
          label="Postponed"
          value={`${postponed.length}${decisions.length ? ` · ${percent(postponed.length / decisions.length)}` : ''}`}
        />
      </div>

      {!enough && (
        <p className="mt-6 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Not enough data yet: {reviewed.length} of 5 reviewed decisions.
          The statistics appear once five reviews are in.
        </p>
      )}

      {enough && (
        <>
          <h2 className="mb-1 mt-8 text-lg font-semibold tracking-tight">Calibration</h2>
          <p className={`${mutedText} mb-3`}>
            If your confidence is honest, each row lands near its midpoint.
            Buckets with fewer than three decisions are hidden.
          </p>

          {calibration.length === 0 ? (
            <p className={mutedText}>No confidence band has three reviewed decisions yet.</p>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <TableHead>
                    <Th>Confidence</Th>
                    <Th numeric>Midpoint</Th>
                    <Th numeric>Decisions</Th>
                    <Th numeric>Hit rate</Th>
                    <Th numeric>Gap</Th>
                  </TableHead>
                </thead>
                <tbody>
                  {calibration.map((bucket) => (
                    <tr key={bucket.label}>
                      <Td>{bucket.label}</Td>
                      <Td numeric>{bucket.midpoint}%</Td>
                      <Td numeric>{bucket.count}</Td>
                      <Td numeric>{percent(bucket.rate)}</Td>
                      <Td numeric>{percent(bucket.rate - bucket.midpoint / 100)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight">Reasoning by state</h2>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <TableHead>
                  <Th>State</Th>
                  <Th numeric>Decisions</Th>
                  <Th numeric>Sound</Th>
                </TableHead>
              </thead>
              <tbody>
                {byState.map((row) => (
                  <tr key={row.state}>
                    <Td>{row.state}</Td>
                    <Td numeric>{row.count}</Td>
                    <Td numeric>{percent(row.soundShare)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight">By tag</h2>
          {byTag.length === 0 ? (
            <p className={mutedText}>No tags on reviewed decisions yet.</p>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[24rem] text-sm">
                <thead>
                  <TableHead>
                    <Th>Tag</Th>
                    <Th numeric>Decisions</Th>
                    <Th numeric>Sound</Th>
                  </TableHead>
                </thead>
                <tbody>
                  {byTag.map((row) => (
                    <tr key={row.tag}>
                      <Td>{row.tag}</Td>
                      <Td numeric>{row.count}</Td>
                      <Td numeric>{percent(row.soundShare)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
