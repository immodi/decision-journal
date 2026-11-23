import type { Timestamp } from 'firebase/firestore';

export type DecisionState =
  | 'calm'
  | 'tired'
  | 'stressed'
  | 'rushed'
  | 'anxious'
  | 'excited'
  | 'other';

export type DecisionStatus = 'open' | 'reviewed';
export type PredictionResult = 'yes' | 'partly' | 'no';
export type ReasoningRating = 'sound' | 'flawed' | 'unsure';

/** The `review` map; null until the decision is reviewed. */
export interface Review {
  reviewedAt: Timestamp | null;
  outcome: string;
  predictionResult: PredictionResult;
  reasoningRating: ReasoningRating;
  lesson: string;
}

/** The shared contract with the Android client; see docs/Spec.md section 4. */
export interface Decision {
  id: string;
  title: string;
  options: string[];
  reasoning: string;
  prediction: string;
  confidence: number;
  state: DecisionState;
  tags: string[];
  reviewDate: Timestamp | null;
  postponedAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  status: DecisionStatus;
  review: Review | null;
}

export interface DecisionInput {
  title: string;
  options: string[];
  reasoning: string;
  prediction: string;
  confidence: number;
  state: DecisionState;
  tags: string[];
  reviewDate: Timestamp;
}

export interface ReviewInput {
  outcome: string;
  predictionResult: PredictionResult;
  reasoningRating: ReasoningRating;
  lesson: string;
}

export interface Settings {
  reminderTime: string;
  defaultReviewDays: number;
}
