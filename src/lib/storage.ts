import type { AppData } from '@/types';

const STORAGE_KEY = 'sci-immobilier-data';

function getDefaultData(): AppData {
  return {
    properties: [],
    expenses: [],
    incomes: [],
    loans: [],
    interventions: [],
    contacts: [],
    documents: [],
    lots: [],
    rentTracking: [],
    chargePayments: [],
    settings: {
      regimeFiscal: 'IR',
      nomSCI: 'Ma SCI',
      associes: [
        { id: '1', nom: 'Associe 1', quotePart: 50 },
        { id: '2', nom: 'Associe 2', quotePart: 50 },
      ],
    },
  };
}

function migrateData(data: AppData): AppData {
  // Ensure new fields exist on properties (backward compat with old exports)
  data.properties = (data.properties ?? []).map((p) => {
    const migrated = { ...p };
    if (migrated.fraisAgence == null) migrated.fraisAgence = 0;
    if (migrated.fraisDossier == null) migrated.fraisDossier = 0;
    if (migrated.fraisCourtage == null) migrated.fraisCourtage = 0;
    if (migrated.montantMobilier == null) migrated.montantMobilier = 0;
    return migrated;
  });
  data.interventions = data.interventions ?? [];
  data.contacts = data.contacts ?? [];
  data.documents = data.documents ?? [];
  data.rentTracking = data.rentTracking ?? [];
  data.chargePayments = data.chargePayments ?? [];
  data.lots = (data.lots ?? []).map((l) => {
    const migrated = { ...l };
    if (!migrated.historiqueLoyers) {
      migrated.historiqueLoyers = [{ id: '0', date: new Date().toISOString().slice(0, 10), montant: migrated.loyerMensuel }];
    }
    return migrated;
  });
  if (!data.settings.associes) {
    data.settings.associes = [
      { id: '1', nom: 'Associe 1', quotePart: 50 },
      { id: '2', nom: 'Associe 2', quotePart: 50 },
    ];
  }
  return data;
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    return migrateData({ ...getDefaultData(), ...JSON.parse(raw) });
  } catch {
    return getDefaultData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const EXPORT_VERSION = 2;

export function exportData(): string {
  return JSON.stringify({
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: loadData(),
  }, null, 2);
}

export function importData(json: string): AppData {
  const parsed = JSON.parse(json);
  // Detect format: version 2+ has { version, data }, legacy is flat AppData
  const raw = parsed.version && parsed.data ? parsed.data : parsed;
  const merged = migrateData({ ...getDefaultData(), ...raw });
  saveData(merged);
  return merged;
}
