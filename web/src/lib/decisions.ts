import { Timestamp } from 'firebase/firestore';
import type {
  Decision,
  DecisionState,
  PredictionResult,
  ReasoningRating,
} from '../types';

export const STATES: DecisionState[] = [
  'calm',
  'tired',
  'stressed',
  'rushed',
  'anxious',
  'excited',
  'other',
];

export const SUGGESTED_TAGS: string[] = ['work', 'money', 'relationships', 'health'];

export const PREDICTION_RESULTS: Array<readonly [PredictionResult, string]> = [
  ['yes', 'Yes'],
  ['partly', 'Partly'],
  ['no', 'No'],
];

export const REASONING_RATINGS: Array<readonly [ReasoningRating, string]> = [
  ['sound', 'Sound'],
  ['flawed', 'Flawed'],
  ['unsure', 'Unsure'],
];

export const QUICK_DAYS: Array<readonly [number, string]> = [
  [7, 'One week'],
  [30, 'One month'],
  [90, 'Three months'],
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

export function inDays(days: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + days * DAY_MS));
}

export function formatDate(value: Timestamp | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function isOverdue(decision: Decision): boolean {
  if (decision.status !== 'open') return false;
  const reviewDate = toDate(decision.reviewDate);
  return reviewDate !== null && reviewDate.getTime() <= Date.now();
}

export function dateInputValue(value: Timestamp | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromInput(value: string): Timestamp | null {
  if (!value) return null;
  return Timestamp.fromDate(new Date(`${value}T12:00:00`));
}

export function sortByReviewDate(list: Decision[]): Decision[] {
  return [...list].sort(
    (a, b) => (toDate(a.reviewDate)?.getTime() ?? 0) - (toDate(b.reviewDate)?.getTime() ?? 0),
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
