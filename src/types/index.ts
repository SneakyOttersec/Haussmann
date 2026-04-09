export type TaxRegime = 'IR' | 'IS';

/**
 * Granular tax regime used for multi-regime comparison.
 * - ir_reel     : location nue, frais reels (revenus fonciers)
 * - ir_micro    : location nue, micro-foncier (abattement 30%, plafond 15 000 €)
 * - lmnp_reel   : location meublee, reel BIC avec amortissements
 * - lmnp_micro  : location meublee, micro-BIC (abattement 50%, plafond 77 700 €)
 * - is          : SCI/SARL a l'IS (taux 15% / 25%)
 */
export type RegimeFiscalType = 'ir_reel' | 'ir_micro' | 'lmnp_reel' | 'lmnp_micro' | 'is';

export const REGIME_FISCAL_LABELS: Record<RegimeFiscalType, string> = {
  ir_reel: 'IR - Foncier reel',
  ir_micro: 'IR - Micro-foncier',
  lmnp_reel: 'LMNP - Reel BIC',
  lmnp_micro: 'LMNP - Micro-BIC',
  is: 'IS (SCI/SARL)',
};

export const REGIME_FISCAL_SHORT: Record<RegimeFiscalType, string> = {
  ir_reel: 'IR reel',
  ir_micro: 'IR micro',
  lmnp_reel: 'LMNP reel',
  lmnp_micro: 'LMNP micro',
  is: 'IS',
};

/** Convert legacy TaxRegime to granular RegimeFiscalType */
export function toRegimeFiscalType(r: TaxRegime): RegimeFiscalType {
  return r === 'IR' ? 'ir_reel' : 'is';
}

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

export type PropertyStatus =
  | 'prospection'
  | 'offre'
  | 'compromis'
  | 'acte'
  | 'travaux'
  | 'location'
  | 'exploitation';

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  prospection: 'Prospection',
  offre: 'Offre',
  compromis: 'Compromis',
  acte: 'Acte signe',
  travaux: 'Travaux',
  location: 'Mise en location',
  exploitation: 'Exploitation',
};

export const PROPERTY_STATUS_ORDER: PropertyStatus[] = [
  'prospection', 'offre', 'compromis', 'acte', 'travaux', 'location', 'exploitation',
];

export interface StatusDocument {
  nom: string;
  data: string;
  type: string;
  taille: number;
}

export interface AllocationCredit {
  bien: number;
  travaux: number;
  notaire: number;
  agence: number;
  autre: number;
}

export interface Property {
  id: string;
  nom: string;
  adresse: string;
  type: PropertyType;
  prixAchat: number;
  dateSaisie: string;
  fraisNotaire: number;
  fraisAgence: number;
  fraisDossier: number;
  fraisCourtage: number;
  montantTravaux: number;
  montantMobilier: number;
  surfaceM2?: number;
  notes?: string;
  statut?: PropertyStatus;
  allocationCredit?: AllocationCredit;
  /** Date (YYYY-MM-DD) at which each status phase was reached */
  statusDates?: Partial<Record<PropertyStatus, string>>;
  /** Document attached to each status phase */
  statusDocs?: Partial<Record<PropertyStatus, StatusDocument>>;
  simulationId?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Interventions / Travaux ---

export type InterventionStatut = 'planifie' | 'en_cours' | 'termine';
export type InterventionType = 'travaux' | 'intervention';

export const INTERVENTION_STATUT_LABELS: Record<InterventionStatut, string> = {
  planifie: 'Planifie',
  en_cours: 'En cours',
  termine: 'Termine',
};

export const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  travaux: 'Travaux',
  intervention: 'Intervention',
};

export interface InterventionPJ {
  nom: string;
  data: string;
  type: string;
  taille: number;
}

export interface Intervention {
  id: string;
  propertyId: string;
  /** 'travaux' (gros chantier) or 'intervention' (maintenance courante). Defaults to 'intervention' for backward compat. */
  interventionType?: InterventionType;
  /** Lot concerne (optionnel) */
  lotId?: string;
  date: string;
  montant: number;
  prestataire: string;
  description: string;
  notes?: string;
  statut: InterventionStatut;
  pieceJointe?: InterventionPJ;
  createdAt: string;
  updatedAt: string;
}

// --- Contacts / Prestataires ---

export type ContactRole = 'agence' | 'gestionnaire' | 'artisan' | 'notaire' | 'banque' | 'assureur' | 'autre';

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  agence: 'Agence immobiliere',
  gestionnaire: 'Gestionnaire locatif',
  artisan: 'Artisan',
  notaire: 'Notaire',
  banque: 'Banque',
  assureur: 'Assureur',
  autre: 'Autre',
};

export interface Contact {
  id: string;
  propertyId?: string;
  nom: string;
  role: ContactRole;
  telephone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Documents ---

export type DocumentCategory = 'devis' | 'facture' | 'copro' | 'fiscal' | 'autre';

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  devis: 'Devis',
  facture: 'Facture',
  copro: 'Copropriete',
  fiscal: 'Document fiscal',
  autre: 'Autre',
};

export interface PropertyDocument {
  id: string;
  propertyId: string;
  nom: string;
  categorie: DocumentCategory;
  data: string;
  type: string;
  taille: number;
  ajouteLe: string;
  /** If this doc was auto-created from an intervention/travaux PJ */
  linkedInterventionId?: string;
}

// --- Lots ---

export type LotStatut = 'occupe' | 'vacant';

export interface RentHistoryEntry {
  id: string;
  date: string;
  montant: number;
}

export interface Lot {
  id: string;
  propertyId: string;
  nom: string;
  etage?: string;
  surface?: number;
  loyerMensuel: number;
  statut: LotStatut;
  historiqueLoyers?: RentHistoryEntry[];
}

// --- Rent tracking (month by month) ---

export type RentMonthStatus = 'paye' | 'partiel' | 'impaye' | 'vacant' | 'travaux';
export type PartielRaison = 'impaye' | 'vacance_partielle';

export const RENT_MONTH_STATUS_LABELS: Record<RentMonthStatus, string> = {
  paye: 'Paye',
  partiel: 'Partiel',
  impaye: 'Impaye',
  vacant: 'Vacant',
  travaux: 'En travaux',
};

export interface RentMonthEntry {
  id: string;
  propertyId: string;
  lotId: string;
  /** "YYYY-MM" e.g. "2025-03" */
  yearMonth: string;
  /** Loyer attendu pour ce mois (snapshot du loyer du lot au moment de l'enregistrement) */
  loyerAttendu: number;
  /** Loyer effectivement percu (0 pour vacant/impaye) */
  loyerPercu: number;
  statut: RentMonthStatus;
  /** Raison du paiement partiel (impaye ou vacance partielle du mois) */
  partielRaison?: PartielRaison;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRevision {
  id: string;
  /** Date d'effet de la revision (YYYY-MM-DD) */
  dateEffet: string;
  montant: number;
  notes?: string;
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
  /** Historique des revisions de prix. Ordre indifferent — trie par dateEffet a l'utilisation. */
  revisions?: ExpenseRevision[];
  /**
   * True once the user has confirmed that a real contract / quote backs this
   * amount (used during pre-acte to mark which simulated charges are now firm).
   */
  priceValidated?: boolean;
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

export interface LoanPJ {
  nom: string;
  data: string;
  type: string;
  taille: number;
  ajouteLe: string;
}

/**
 * Differe type for a loan:
 * - "partiel": during the defer period, only the interest is paid (no capital).
 * - "total":   during the defer period, nothing is paid; interest is capitalized.
 *              The loan starts amortizing on the inflated principal afterwards.
 */
export type DifferType = "partiel" | "total";

export interface LoanDetails {
  id: string;
  propertyId: string;
  type: LoanType;
  montantEmprunte: number;
  tauxAnnuel: number;
  /** Total duration in years, INCLUDING any defer period. */
  dureeAnnees: number;
  dateDebut: string;
  assuranceAnnuelle: number;
  banque?: string;
  documents?: LoanPJ[];
  /**
   * True once the user has confirmed that the loan reflects a real bank offer
   * (and not just a simulation). Drives the "Theorique"/"Reel" label on the
   * Credit section in pre-acte properties.
   */
  offerValidated?: boolean;
  /** Number of months of defer at the start of the loan (0 = no defer). */
  differeMois?: number;
  /** Defer type — only meaningful if differeMois > 0. */
  differeType?: DifferType;
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
  // Identity — persistent unique ID; when present, saving overwrites the existing simulation
  id?: string;

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
  triProjet: number;
  projection: YearProjection[];
}

export interface SimulationSnapshot {
  inputs: CalculatorInputs;
  savedAt: string;
}

export interface SavedSimulation {
  id: string;
  nom: string;
  inputs: CalculatorInputs;
  savedAt: string;
  /** Previous versions of this simulation (most recent first). Capped to keep storage reasonable. */
  history?: SimulationSnapshot[];
}

export interface Associe {
  id: string;
  nom: string;
  quotePart: number; // percentage, e.g. 50 = 50%
}

export interface AppSettings {
  regimeFiscal: TaxRegime;
  nomSCI: string;
  siren?: string;
  adresseSiege?: string;
  capitalSocial?: number;
  associes: Associe[];
  seuilAlerteTresorerie?: number;
  googleClientId?: string;
}

// --- Charge payments (budget vs reel) ---

export type ChargePaymentStatus = 'paye' | 'partiel' | 'en_attente';

export const CHARGE_PAYMENT_STATUS_LABELS: Record<ChargePaymentStatus, string> = {
  paye: 'Paye',
  partiel: 'Partiel',
  en_attente: 'En attente',
};

export interface ChargePaymentEntry {
  id: string;
  /** Linked recurring expense */
  expenseId: string;
  propertyId: string;
  /** "YYYY-MM" for mensuel, "YYYY-Q1".."YYYY-Q4" for trimestriel, "YYYY" for annuel */
  periode: string;
  montantAttendu: number;
  montantPaye: number;
  statut: ChargePaymentStatus;
  datePaiement?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  properties: Property[];
  expenses: Expense[];
  incomes: Income[];
  loans: LoanDetails[];
  interventions: Intervention[];
  contacts: Contact[];
  documents: PropertyDocument[];
  lots: Lot[];
  rentTracking: RentMonthEntry[];
  chargePayments: ChargePaymentEntry[];
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
