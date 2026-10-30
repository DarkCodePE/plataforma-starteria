import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
  maxRetries?: number;
}

export interface UseAutosaveReturn {
  state: SaveState;
  lastSavedAt: Date | null;
  error: Error | null;
  isDirty: boolean;
  retrySave: () => void;
}

export function useAutosave<T>({
  data,
  saveFn,
  delay = 2000,
  enabled = true,
  maxRetries = 3,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [state, setState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Mounting a screen is a read. Establish the rendered data as the baseline
  // and only persist a subsequent user-visible change.
  const lastSavedJson = useRef<string | null>(enabled ? JSON.stringify(data) : null);
  const wasEnabledRef = useRef(enabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const saveFnRef = useRef(saveFn);
  const dataRef = useRef(data);
  const mountedRef = useRef(true);

  // Keep refs fresh without triggering effects
  saveFnRef.current = saveFn;
  dataRef.current = data;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const performSave = useCallback(async (dataToSave: T) => {
    if (!mountedRef.current) return;

    const json = JSON.stringify(dataToSave);
    if (json === lastSavedJson.current) {
      setIsDirty(false);
      return;
    }

    setState('saving');
    setError(null);

    try {
      await saveFnRef.current(dataToSave);
      if (!mountedRef.current) return;

      lastSavedJson.current = json;
      retryCountRef.current = 0;
      setState('saved');
      setLastSavedAt(new Date());
      setIsDirty(false);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;

      const saveError = err instanceof Error ? err : new Error(String(err));

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        const backoff = Math.pow(2, retryCountRef.current) * 1000;
        timerRef.current = setTimeout(() => {
          performSave(dataToSave);
        }, backoff);
      } else {
        setState('error');
        setError(saveError);
      }
    }
  }, [maxRetries]);

  // Debounce data changes
  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      setIsDirty(false);
      return;
    }

    const json = JSON.stringify(data);
    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      lastSavedJson.current = json;
      setIsDirty(false);
      return;
    }
    if (json === lastSavedJson.current) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);
    retryCountRef.current = 0;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      performSave(data);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [data, delay, enabled, performSave]);

  // Guard de navegación — previene cerrar tab con datos sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timerRef.current !== null || state === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Flush save on unmount si hay datos sucios
      if (timerRef.current && enabled) {
        // Fire-and-forget — no podemos await en cleanup
        saveFnRef.current?.(dataRef.current).catch(() => {});
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled]);

  const retrySave = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    performSave(dataRef.current);
  }, [performSave]);

  return { state, lastSavedAt, error, isDirty, retrySave };
}
