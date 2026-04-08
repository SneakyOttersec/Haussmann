"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppData } from "@/types";
import { loadDataWithBlobs, saveData } from "@/lib/storage";

export function useAppData() {
  const [data, setDataState] = useState<AppData | null>(null);

  useEffect(() => {
    loadDataWithBlobs().then(setDataState);
  }, []);

  const setData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setDataState((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveData(next);
      return next;
    });
  }, []);

  return { data, setData };
}
