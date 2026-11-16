"use client";

import { useCallback, useEffect, useState } from "react";

type State<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

/** Fetches one independent API route with a timeout; never stays "loading" forever. */
export function useApi<T>(url: string, label: string, timeoutMs = 20000) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.success) throw new Error(j?.error || `Unable to load ${label} data.`);
        setState({ status: "ready", data: j.data as T });
      })
      .catch((e: Error) =>
        setState({
          status: "error",
          error: e.name === "AbortError" ? `Loading ${label} took too long.` : e.message || `Unable to load ${label} data.`,
        }),
      )
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [url, label, timeoutMs, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  return { state, retry };
}
