'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
/** Distinguish unavailable data from a genuine empty response. */
export function useRemote<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let current = true;
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    api
      .get<T>(url)
      .then((value) => {
        if (current) setData(value);
      })
      .catch(() => {
        if (current)
          setError(
            'Could not load this content. Check your connection and try again.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [url, version]);
  return { data, loading, error, retry };
}
