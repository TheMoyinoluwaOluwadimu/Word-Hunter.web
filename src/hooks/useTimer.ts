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

  /** Starts already `offsetSeconds` in (a challenge resumed after a reload keeps its original clock). */
  const startFrom = useCallback((offsetSeconds: number) => {
    if (startRef.current !== null) return;
    const offset = Math.max(0, Math.floor(offsetSeconds));
    startRef.current = Date.now() - offset * 1000;
    setElapsed(offset);
    setStatus('running');
  }, []);

  /** Stops the clock and returns the final time in seconds (null if it never started). */
  const stop = useCallback((): number | null => {
    if (startRef.current === null) return null;
    const secs = Math.floor((Date.now() - startRef.current) / 1000);
    setElapsed(secs);
    setStatus('stopped');
    return secs;
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsed(0);
    setStatus('idle');
  }, []);

  return { status, elapsed, start, startFrom, stop, reset };
}
