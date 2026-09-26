"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

type Query = Record<string, string | number | undefined | null>;

/** Loads an API resource and re-fetches when `path` or `query` change. */
export function useApi<T>(path: string | null, query?: Query) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const queryKey = JSON.stringify(query ?? {});
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(path, { query: JSON.parse(queryKey) as Query });
      if (id === requestId.current) setData(result);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof ApiError ? e.message : "Une erreur est survenue.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path, queryKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}
