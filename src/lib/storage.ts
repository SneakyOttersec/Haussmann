import type { AppData } from '@/types';

const STORAGE_KEY = 'sci-immobilier-data';

function getDefaultData(): AppData {
  return {
    properties: [],
    expenses: [],
    incomes: [],
    loans: [],
    settings: { regimeFiscal: 'IR', nomSCI: 'Ma SCI' },
  };
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    return { ...getDefaultData(), ...JSON.parse(raw) };
  } catch {
    return getDefaultData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function importData(json: string): AppData {
  const data = JSON.parse(json);
  const merged = { ...getDefaultData(), ...data };
  saveData(merged);
  return merged;
}
