import { useCallback, useRef, useState } from 'react';

export function useConfirmAction<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const runningRef = useRef(false);

  const request = useCallback((value: T) => {
    if (runningRef.current) return;
    setTarget(value);
  }, []);

  const cancel = useCallback(() => {
    if (runningRef.current) return;
    setTarget(null);
  }, []);

  const run = useCallback(
    async (action: (value: T) => Promise<unknown> | void) => {
      if (runningRef.current || target === null) return;
      runningRef.current = true;
      try {
        await action(target);
      } catch {
      } finally {
        runningRef.current = false;
        setTarget(null);
      }
    },
    [target],
  );

  return { target, isOpen: target !== null, request, cancel, run };
}
