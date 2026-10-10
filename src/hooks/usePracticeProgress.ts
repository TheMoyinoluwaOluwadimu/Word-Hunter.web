import { useCallback, useState } from 'react';
import { loadPractice, recordPracticeSolve } from '../lib/practice';
import type { PracticeProgress } from '../lib/practice';

export function usePracticeProgress() {
  const [progress, setProgress] = useState<PracticeProgress>(loadPractice);

  const registerPracticeSolve = useCallback((file: string, seconds: number) => {
    const result = recordPracticeSolve(file, seconds);
    setProgress(result.progress);
    return result;
  }, []);

  return { progress, registerPracticeSolve };
}
