export type TaxRegime = 'IR' | 'IS';

export type PropertyType =
  | 'appartement'
  | 'maison'
  | 'immeuble'
  | 'local_commercial'
  | 'parking';

export type ExpenseCategory =
  | 'credit'
  | 'taxe_fonciere'
  | 'assurance_pno'
  | 'gestion_locative'
  | 'copropriete'
  | 'reparations'
  | 'charges_locatives'
  | 'vacance'
  | 'frais_notaire'
  | 'travaux'
  | 'ameublement'
  | 'autre';

export type ExpenseFrequency = 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel';

export type IncomeCategory = 'loyer' | 'parking' | 'charges_recuperees' | 'autre';

export type IncomeFrequency = 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel';

export type LoanType = 'amortissable' | 'in_fine';

export type AssurancePretMode = 'eur' | 'pct';

export interface Property {
  id: string;
  nom: string;
  adresse: string;
  type: PropertyType;
  prixAchat: number;
  dateAchat: string;
  fraisNotaire: number;
  montantTravaux: number;
  surfaceM2?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  propertyId: string;
  categorie: ExpenseCategory;
  label: string;
  montant: number;
  frequence: ExpenseFrequency;
  dateDebut: string;
  dateFin?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  propertyId: string;
  categorie: IncomeCategory;
  label: string;
  montant: number;
  frequence: IncomeFrequency;
  dateDebut: string;
  dateFin?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDetails {
  id: string;
  propertyId: string;
  type: LoanType;
  montantEmprunte: number;
  tauxAnnuel: number;
  dureeAnnees: number;
  dateDebut: string;
  assuranceAnnuelle: number;
}

export interface LotLoyer {
  id: string;
  nom: string;
  loyerMensuel: number;
}

export interface LotMobilier {
  id: string;
  nom: string;
  montant: number;
}

export type TravauxCategorie =
  | 'toiture'
  | 'travaux_divers'
  | 'electricite'
  | 'etancheite'
  | 'ascenseur'
  | 'agencement'
  | 'structure'
  | 'autre';

export interface LotTravaux {
  id: string;
  nom: string;
  montant: number;
  dureeAmortissement: number; // years
}

export const TRAVAUX_CATEGORIES: { value: TravauxCategorie; label: string; duree: number }[] = [
  { value: 'toiture', label: 'Toiture', duree: 25 },
  { value: 'travaux_divers', label: 'Travaux divers', duree: 18 },
  { value: 'electricite', label: 'Electricite', duree: 25 },
  { value: 'etancheite', label: 'Etancheite', duree: 15 },
  { value: 'ascenseur', label: 'Ascenseur', duree: 15 },
  { value: 'agencement', label: 'Agencement interieur', duree: 15 },
  { value: 'structure', label: 'Structure', duree: 50 },
  { value: 'autre', label: 'Autre', duree: 18 },
];

export const AMORT_DUREES = {
  bien: 25,
  notaire: 1,
  agence: 1,
  meubles: 7,
};

export interface Attachment {
  id: string;
  nom: string;
  type: string;
  taille: number;
  data: string;
  ajouteLe: string;
}

export type EvolvableKey =
  | 'lopiloyer'
  | 'assurancePNO'
  | 'taxeFonciere'
  | 'chargesCopro'
  | 'comptabilite'
  | 'cfeCrl'
  | 'entretien'
  | 'gli'
  | 'gestionLocative'
  | 'autresCharges';

export interface CalculatorInputs {
  // Meta
  nomSimulation: string;
  adresse: string;

  // Photo
  photo: string; // base64 data URI

  // Acquisition
  prixAchat: number;
  fraisNotairePct: number;
  fraisAgence: number;
  surfaceM2: number;
  fraisDossier: number;
  fraisCourtage: number;
  montantTravaux: number;
  lotsTravaux: LotTravaux[];
  lotsMobilier: LotMobilier[];
  montantMobilierTotal: number; // computed total

  // Notes
  pointsNotables: string;
  attachments: Attachment[];

  // Revenus
  lots: LotLoyer[];
  loyerMensuel: number; // computed total, kept for backward compat
  autresRevenusAnnuels: number;
  tauxVacance: number;

  // Financement
  apportPersonnel: number;
  montantEmprunte: number;
  tauxCredit: number;
  dureeCredit: number;
  typePret: LoanType;
  assurancePretMode: AssurancePretMode;
  assurancePretAnnuelle: number;
  assurancePretPct: number;
  differePretMois: number;
  differeLoyer: number;

  // Evolutions annuelles (% d'augmentation par an, ex: 0.05 = +5%/an)
  evolutions: Partial<Record<EvolvableKey, number>>;

  // Charges
  chargesCopro: number;
  taxeFonciere: number;
  assurancePNO: number;
  gestionLocativePct: number;
  comptabilite: number;
  cfeCrl: number;
  entretien: number;
  gli: number;
  autresChargesAnnuelles: number;

  // Fiscalite
  regimeFiscal: TaxRegime;
  trancheMarginalePct?: number;
  amortissementImmobilierPct?: number;
  amortissementTravauxPct?: number;
  amortissementMobilierPct?: number;
  montantMobilier?: number;

  // Projection
  tauxAppreciation: number;
  dureeDetention: number;
}

export interface YearProjection {
  annee: number;
  loyerBrut: number;
  loyerNet: number;
  charges: number;
  interets: number;
  capitalRembourse: number;
  mensualitesCredit: number;
  cashFlowAvantImpot: number;
  impot: number;
  cashFlowApresImpot: number;
  capitalRestantDu: number;
  valeurBien: number;
  plusValue: number;
}

export interface CalculatorResults {
  apportPersonnel: number;
  rendementBrut: number;
  rendementNet: number;
  rendementNetNet: number;
  cashFlowMensuelAvantImpot: number;
  cashFlowMensuelApresImpot: number;
  cashFlowAnnuelAvantImpot: number;
  cashFlowAnnuelApresImpot: number;
  coutTotalAcquisition: number;
  loyerAnnuelBrut: number;
  loyerAnnuelNet: number;
  chargesAnnuellesTotales: number;
  mensualiteCredit: number;
  taeg: number;
  impotAnnuel: number;
  tri: number;
  projection: YearProjection[];
}

export interface SavedSimulation {
  id: string;
  nom: string;
  inputs: CalculatorInputs;
  savedAt: string;
}

export interface AppSettings {
  regimeFiscal: TaxRegime;
  nomSCI: string;
}

export interface AppData {
  properties: Property[];
  expenses: Expense[];
  incomes: Income[];
  loans: LoanDetails[];
  settings: AppSettings;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  parking: 'Parking',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  credit: 'Mensualite credit',
  taxe_fonciere: 'Taxe fonciere',
  assurance_pno: 'Assurance PNO',
  gestion_locative: 'Gestion locative',
  copropriete: 'Copropriete',
  reparations: 'Reparations / entretien',
  charges_locatives: 'Charges locatives',
  vacance: 'Vacance locative',
  frais_notaire: 'Frais de notaire',
  travaux: 'Travaux',
  ameublement: 'Ameublement',
  autre: 'Autre',
};

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  loyer: 'Loyer',
  parking: 'Parking',
  charges_recuperees: 'Charges recuperees',
  autre: 'Autre',
};

export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  ponctuel: 'Ponctuel',
};

export const EXPENSE_GROUPS: Record<string, ExpenseCategory[]> = {
  'Charges fixes': ['credit', 'taxe_fonciere', 'assurance_pno', 'gestion_locative', 'copropriete'],
  'Charges variables': ['reparations', 'charges_locatives', 'vacance'],
  'Ponctuelles': ['frais_notaire', 'travaux', 'ameublement', 'autre'],
};
