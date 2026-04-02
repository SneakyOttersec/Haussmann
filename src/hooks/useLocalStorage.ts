"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppData } from "@/types";
import { loadData, saveData } from "@/lib/storage";

export function useAppData() {
  const [data, setDataState] = useState<AppData | null>(null);

  useEffect(() => {
    setDataState(loadData());
  }, []);

  const setData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setDataState((prev) => {
      const current = prev ?? loadData();
      const next = typeof updater === "function" ? updater(current) : updater;
      saveData(next);
      return next;
    });
  }, []);

  return { data, setData };
}
