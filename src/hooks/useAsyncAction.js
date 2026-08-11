// src/hooks/useAsyncAction.js
import { useCallback, useRef, useState } from 'react';

const DEFAULT_KEY = '__default__';

export function useAsyncAction() {
  const [, forceRender] = useState(0);
  const activeKeysRef = useRef(new Set());

  const isLoading = useCallback((key = DEFAULT_KEY) => activeKeysRef.current.has(key), []);

  const run = useCallback(async (fn, key = DEFAULT_KEY) => {
    if (activeKeysRef.current.has(key)) return; // trava anti-duplo-clique, por key
    activeKeysRef.current.add(key);
    forceRender((n) => n + 1);
    try {
      return await fn();
    } finally {
      activeKeysRef.current.delete(key);
      forceRender((n) => n + 1);
    }
  }, []);

  return { run, isLoading };
}
