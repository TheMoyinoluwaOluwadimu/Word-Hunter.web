import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { loadPractice, recordPracticeSolve } from '../lib/practice';
import type { PracticeProgress } from '../lib/practice';
import { LOCAL_DATA_EVENT } from '../lib/storage';
import { pushPracticeEntry } from '../lib/sync';

export function usePracticeProgress() {
  const [progress, setProgress] = useState<PracticeProgress>(loadPractice);
  const { user } = useAuth();
  const userId = user?.id;

  // Local data can change under us (sign-in merge, sign-out wipe).
  useEffect(() => {
    const reload = () => setProgress(loadPractice());
    window.addEventListener(LOCAL_DATA_EVENT, reload);
    return () => window.removeEventListener(LOCAL_DATA_EVENT, reload);
  }, []);

  const registerPracticeSolve = useCallback(
    (file: string, seconds: number) => {
      const result = recordPracticeSolve(file, seconds);
      setProgress(result.progress);
      if (userId) void pushPracticeEntry(userId, file, result.progress[file]);
      return result;
    },
    [userId],
  );

  return { progress, registerPracticeSolve };
}
