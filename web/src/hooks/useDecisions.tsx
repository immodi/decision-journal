import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type DocumentReference,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Decision, DecisionInput, ReviewInput } from '../types';

interface DecisionsContextValue {
  decisions: Decision[];
  loading: boolean;
  error: Error | null;
  create: (input: DecisionInput) => Promise<DocumentReference<DocumentData, DocumentData>>;
  update: (id: string, data: Record<string, unknown>) => Promise<void>;
  postpone: (id: string, reviewDate: Timestamp) => Promise<void>;
  review: (id: string, data: ReviewInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const DecisionsContext = createContext<DecisionsContextValue | null>(null);

interface DecisionsProviderProps {
  uid: string;
  children: ReactNode;
}

/**
 * One real-time listener for the whole signed-in session. The journal is a
 * personal dataset, so pages filter in memory rather than issuing new queries.
 */
export function DecisionsProvider({ uid, children }: DecisionsProviderProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const decisionsQuery = query(
      collection(db, 'users', uid, 'decisions'),
      orderBy('createdAt', 'desc'),
      limit(500),
    );

    return onSnapshot(
      decisionsQuery,
      (snapshot) => {
        setDecisions(
          snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Decision),
        );
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      },
    );
  }, [uid]);

  const create = useCallback(
    (input: DecisionInput) => addDoc(collection(db, 'users', uid, 'decisions'), {
      ...input,
      status: 'open',
      review: null,
      postponedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    [uid],
  );

  const update = useCallback(
    (id: string, data: Record<string, unknown>) => updateDoc(
      doc(db, 'users', uid, 'decisions', id),
      { ...data, updatedAt: serverTimestamp() },
    ),
    [uid],
  );

  const postpone = useCallback(
    (id: string, reviewDate: Timestamp) => updateDoc(
      doc(db, 'users', uid, 'decisions', id),
      { reviewDate, postponedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    ),
    [uid],
  );

  const review = useCallback(
    (id: string, data: ReviewInput) => updateDoc(
      doc(db, 'users', uid, 'decisions', id),
      {
        status: 'reviewed',
        review: { ...data, reviewedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      },
    ),
    [uid],
  );

  const remove = useCallback(
    (id: string) => deleteDoc(doc(db, 'users', uid, 'decisions', id)),
    [uid],
  );

  const value = useMemo<DecisionsContextValue>(() => ({
    decisions,
    loading,
    error,
    create,
    update,
    postpone,
    review,
    remove,
  }), [decisions, loading, error, create, update, postpone, review, remove]);

  return (
    <DecisionsContext.Provider value={value}>
      {children}
    </DecisionsContext.Provider>
  );
}

export function useDecisions(): DecisionsContextValue {
  const value = useContext(DecisionsContext);
  if (!value) throw new Error('useDecisions must be used inside DecisionsProvider');
  return value;
}

export function useDecision(id: string | undefined): {
  decision: Decision | null;
  loading: boolean;
  error: Error | null;
} {
  const { decisions, loading, error } = useDecisions();
  return {
    decision: decisions.find((entry) => entry.id === id) ?? null,
    loading,
    error,
  };
}
