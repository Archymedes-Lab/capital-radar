"use client";
import { useCallback, useEffect, useState } from "react";
import type { PipelineEntry, PipelineStatus } from "./types";

const KEY = "archymedes-inv:pipeline:v1";
type Store = Record<string, PipelineEntry>;

export function usePipeline() {
  const [store, setStore] = useState<Store>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setStore(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<PipelineEntry, "status" | "note">>) => {
    setStore((prev) => {
      const cur: PipelineEntry = prev[id] ?? { status: "new", note: "", updated: "" };
      const next = { ...prev, [id]: { ...cur, ...patch, updated: new Date().toISOString() } };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const get = (id: string): PipelineEntry =>
    store[id] ?? { status: "new" as PipelineStatus, note: "", updated: "" };

  return { get, update, ready };
}
