import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerStatus = 'idle' | 'running' | 'stopped';

export function useTimer() {
  const startRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => {
      if (startRef.current !== null) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  const start = useCallback(() => {
    if (startRef.current !== null) return;
    startRef.current = Date.now();
    setStatus('running');
  }, []);

  const stop = useCallback(() => {
    if (startRef.current === null) return;
    setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    setStatus('stopped');
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsed(0);
    setStatus('idle');
  }, []);

  return { status, elapsed, start, stop, reset };
}
