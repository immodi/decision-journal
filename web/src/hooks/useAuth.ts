import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthState {
  user: User | null;
  ready: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(
    () => onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    }),
    [],
  );

  return { user, ready };
}
