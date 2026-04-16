"use client";

import { useState, useEffect, useCallback } from "react";
import type { DonneesApp } from "@/types";
import { loadDataWithBlobs, saveDataDebounced, flushSave } from "@/lib/storage";

// Module-level cache: avoid re-reading the entire dataset (incl. IndexedDB blobs)
// from storage on every page navigation. The first useAppData() does the async load;
// every subsequent mount synchronously reuses the cached snapshot.
let cachedData: DonneesApp | null = null;
let loadPromise: Promise<DonneesApp> | null = null;

function ensureLoaded(): Promise<DonneesApp> {
  if (cachedData) return Promise.resolve(cachedData);
  if (!loadPromise) {
    loadPromise = loadDataWithBlobs().then((d) => {
      cachedData = d;
      return d;
    });
  }
  return loadPromise;
}

export function useAppData() {
  const [data, setDataState] = useState<DonneesApp | null>(cachedData);

  useEffect(() => {
    if (cachedData) return; // already in cache → nothing to load
    let mounted = true;
    ensureLoaded().then((d) => {
      if (mounted) setDataState(d);
    });
    return () => {
      mounted = false;
      // Flush any pending debounced save when this consumer unmounts (page navigation),
      // so that switching pages always commits the latest state to disk.
      flushSave();
    };
  }, []);

  const setData = useCallback((updater: DonneesApp | ((prev: DonneesApp) => DonneesApp)) => {
    setDataState((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      cachedData = next; // keep module cache in sync so the next mount sees fresh data
      saveDataDebounced(next); // coalesce rapid writes (e.g. typing in a form field)
      return next;
    });
  }, []);

  return { data, setData };
}
