import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Settings } from '../types';

const DEFAULTS: Settings = { reminderTime: '09:00', defaultReviewDays: 30 };

interface UseSettingsResult {
  settings: Settings;
  save: (patch: Partial<Settings>) => Promise<void>;
  loading: boolean;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;

    return onSnapshot(
      doc(db, 'users', uid, 'settings', 'preferences'),
      (snapshot) => {
        setSettings({ ...DEFAULTS, ...(snapshot.data() as Partial<Settings> | undefined) });
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const save = async (patch: Partial<Settings>): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'settings', 'preferences'), patch, { merge: true });
  };

  return { settings, save, loading };
}
