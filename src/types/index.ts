export type RegimeFiscal = 'IR' | 'IS';

/**
 * Granular tax regime used for multi-regime comparison.
 * - ir_reel     : location nue, frais reels (revenus fonciers)
 * - ir_micro    : location nue, micro-foncier (abattement 30%, plafond 15 000 €)
 * - lmnp_reel   : location meublee, reel BIC avec amortissements
 * - lmnp_micro  : location meublee, micro-BIC (abattement 50%, plafond 77 700 €)
 * - is          : SCI/SARL a l'IS (taux 15% / 25%)
 */
export type RegimeFiscalDetaille = 'ir_reel' | 'ir_micro' | 'lmnp_reel' | 'lmnp_micro' | 'is';

export const REGIME_FISCAL_DETAILLE_LABELS: Record<RegimeFiscalDetaille, string> = {
  ir_reel: 'IR - Foncier reel',
  ir_micro: 'IR - Micro-foncier',
  lmnp_reel: 'LMNP - Reel BIC',
  lmnp_micro: 'LMNP - Micro-BIC',
  is: 'IS (SCI/SARL)',
};

export const REGIME_FISCAL_DETAILLE_SHORT: Record<RegimeFiscalDetaille, string> = {
  ir_reel: 'IR reel',
  ir_micro: 'IR micro',
  lmnp_reel: 'LMNP reel',
  lmnp_micro: 'LMNP micro',
  is: 'IS',
};

/** Convert legacy RegimeFiscal to granular RegimeFiscalDetaille */
export function versRegimeFiscalDetaille(r: RegimeFiscal): RegimeFiscalDetaille {
  return r === 'IR' ? 'ir_reel' : 'is';
}

export type TypeBien =
  | 'appartement'
  | 'maison'
  | 'immeuble'
  | 'local_commercial'
  | 'parking';

export type CategorieDepense =
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

export type FrequenceDepense = 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel';

export type CategorieRevenu = 'loyer' | 'parking' | 'charges_recuperees' | 'autre';

export type FrequenceRevenu = 'mensuel' | 'trimestriel' | 'annuel' | 'ponctuel';

export type TypePret = 'amortissable' | 'in_fine';

export type ModeAssurancePret = 'eur' | 'pct';

export type StatutBien =
  | 'prospection'
  | 'offre'
  | 'compromis'
  | 'acte'
  | 'travaux'
  | 'location'
  | 'exploitation';

export const STATUT_BIEN_LABELS: Record<StatutBien, string> = {
  prospection: 'Prospection',
  offre: 'Offre',
  compromis: 'Compromis',
  acte: 'Acte signe',
  travaux: 'Travaux',
  location: 'Mise en location',
  exploitation: 'Exploitation',
};

export const STATUT_BIEN_ORDER: StatutBien[] = [
  'prospection', 'offre', 'compromis', 'acte', 'travaux', 'location', 'exploitation',
];

export interface StatutDocument {
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
  dossier: number;
  garantie: number;
  /** Mobilier (pour une location meublee). Ajoute en 2026 — avant cette date
   *  il etait regroupe avec "autre". Les allocations existantes sans ce
   *  champ sont backfilled depuis bien.montantMobilier. */
  mobilier?: number;
  autre: number;
}

export type DpeGrade = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "VIERGE";

export interface Bien {
  id: string;
  nom: string;
  adresse: string;
  type: TypeBien;
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
  /** Ville / commune du bien. Utilisee pour les exports et la localisation. */
  ville?: string;
  /** Annee de construction du bien (ex: 1920). */
  anneeConstruction?: number;
  /** Diagnostic de Performance Energetique. "VIERGE" pour un bien non encore
   *  diagnostique (ex: pre-acte). Depuis 2023, un bien G est interdit a la
   *  location, d'ou l'importance de le tracer. */
  dpe?: DpeGrade;
  /** Apport personnel explicite. Si absent, derive de coutTotal - emprunt. */
  apport?: number;
  statut?: StatutBien;
  allocationCredit?: AllocationCredit;
  /** Date (YYYY-MM-DD) at which each status phase was reached */
  statusDates?: Partial<Record<StatutBien, string>>;
  /** Document attached to each status phase */
  statusDocs?: Partial<Record<StatutBien, StatutDocument>>;
  simulationId?: string;
  /** Taux de vacance locative theorique global au niveau du bien (0..1).
   *  Quand defini, ecrase le tauxVacance de chaque lot pour le calcul
   *  du revenu theorique. */
  tauxVacanceGlobal?: number;
  /** Verrou sur le snapshot de la simulation initiale. Par defaut verrouille
   *  (lecture seule). Quand deverrouille, l'utilisateur peut editer les
   *  valeurs du snapshot (stockees dans simulationSnapshotOverrides). */
  simulationSnapshotLocked?: boolean;
  /** Overrides utilisateur sur le snapshot de simulation initiale.
   *  Cle = nom du champ (voir SimSnapshot), valeur = override. */
  simulationSnapshotOverrides?: Record<string, number | string>;
  /** Historique des modifications du snapshot (chrono, plus recent en premier). */
  simulationSnapshotHistory?: Array<{
    id: string;
    date: string; // ISO
    field: string;
    oldValue: number | string;
    newValue: number | string;
  }>;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Interventions / Travaux ---

export type InterventionStatut = 'planifie' | 'en_cours' | 'termine';
export type TypeIntervention = 'travaux' | 'intervention';

export const INTERVENTION_STATUT_LABELS: Record<InterventionStatut, string> = {
  planifie: 'Planifie',
  en_cours: 'En cours',
  termine: 'Termine',
};

export const TYPE_INTERVENTION_LABELS: Record<TypeIntervention, string> = {
  travaux: 'Travaux',
  intervention: 'Intervention',
};

export interface PieceJointeIntervention {
  nom: string;
  data: string;
  type: string;
  taille: number;
}

export interface Intervention {
  id: string;
  bienId: string;
  /** 'travaux' (gros chantier) or 'intervention' (maintenance courante). Defaults to 'intervention' for backward compat. */
  interventionType?: TypeIntervention;
  /** Lot concerne (optionnel) */
  lotId?: string;
  date: string;
  montant: number;
  prestataire: string;
  description: string;
  notes?: string;
  statut: InterventionStatut;
  pieceJointe?: PieceJointeIntervention;
  /**
   * For travaux only: true if this line is funded by the pret's "enveloppe
   * travaux" (allocationCredit.travaux). Used to track how much of the
   * envelope has been consumed.
   */
  financeParCredit?: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Contacts / Prestataires ---

export type RoleContact = 'agence' | 'gestionnaire' | 'artisan' | 'notaire' | 'banque' | 'assureur' | 'autre';

export const ROLE_CONTACT_LABELS: Record<RoleContact, string> = {
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
  bienId?: string;
  nom: string;
  role: RoleContact;
  telephone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Documents ---

export type CategorieDocument = 'ddt' | 'dpe' | 'devis' | 'facture' | 'copro' | 'fiscal' | 'autre';

export const CATEGORIE_DOCUMENT_LABELS: Record<CategorieDocument, string> = {
  ddt: 'DDT',
  dpe: 'DPE',
  devis: 'Devis',
  facture: 'Facture',
  copro: 'Copropriete',
  fiscal: 'Document fiscal',
  autre: 'Autre',
};

export interface DocumentBien {
  id: string;
  bienId: string;
  nom: string;
  categorie: CategorieDocument;
  data: string;
  type: string;
  taille: number;
  ajouteLe: string;
  /** If this doc was auto-created from an intervention/travaux PJ */
  linkedInterventionId?: string;
}

// --- Lots ---

export type LotStatut = 'occupe' | 'vacant' | 'travaux';

export interface EntreeHistoriqueLoyer {
  id: string;
  date: string;
  montant: number;
}

export interface Lot {
  id: string;
  bienId: string;
  nom: string;
  etage?: string;
  surface?: number;
  loyerMensuel: number;
  statut: LotStatut;
  historiqueLoyers?: EntreeHistoriqueLoyer[];
  /** Taux de vacance locative theorique (0..1, ex: 0.05 = 5%/an).
   *  Utilise pour ajuster le revenu theorique a pleine occupation. */
  tauxVacance?: number;
}

// --- Rent tracking (month by month) ---

export type StatutSuiviMensuelLoyer = 'paye' | 'partiel' | 'impaye' | 'vacant' | 'travaux';
export type PartielRaison = 'impaye' | 'vacance_partielle';

export const STATUT_SUIVI_MENSUEL_LOYER_LABELS: Record<StatutSuiviMensuelLoyer, string> = {
  paye: 'Paye',
  partiel: 'Partiel',
  impaye: 'Impaye',
  vacant: 'Vacant',
  travaux: 'En travaux',
};

export interface SuiviMensuelLoyer {
  id: string;
  bienId: string;
  lotId: string;
  /** "YYYY-MM" e.g. "2025-03" */
  yearMonth: string;
  /** Loyer attendu pour ce mois (snapshot du loyer du lot au moment de l'enregistrement) */
  loyerAttendu: number;
  /** Loyer effectivement percu (0 pour vacant/impaye) */
  loyerPercu: number;
  statut: StatutSuiviMensuelLoyer;
  /** Raison du paiement partiel (impaye ou vacance partielle du mois) */
  partielRaison?: PartielRaison;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevisionDepense {
  id: string;
  /** Date d'effet de la revision (YYYY-MM-DD) */
  dateEffet: string;
  montant: number;
  notes?: string;
}

export interface Depense {
  id: string;
  bienId: string;
  categorie: CategorieDepense;
  label: string;
  montant: number;
  frequence: FrequenceDepense;
  dateDebut: string;
  dateFin?: string;
  notes?: string;
  /** Historique des revisions de prix. Ordre indifferent — trie par dateEffet a l'utilisation. */
  revisions?: RevisionDepense[];
  /**
   * True once the user has confirmed that a real contract / quote backs this
   * amount (used during pre-acte to mark which simulated charges are now firm).
   */
  priceValidated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Revenu {
  id: string;
  bienId: string;
  categorie: CategorieRevenu;
  label: string;
  montant: number;
  frequence: FrequenceRevenu;
  dateDebut: string;
  dateFin?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PieceJointePret {
  nom: string;
  data: string;
  type: string;
  taille: number;
  ajouteLe: string;
}

/**
 * Differe type for a pret:
 * - "partiel": during the defer period, only the interest is paid (no capital).
 * - "total":   during the defer period, nothing is paid; interest is capitalized.
 *              The pret starts amortizing on the inflated principal afterwards.
 */
export type TypeDiffere = "partiel" | "total";

export interface Pret {
  id: string;
  bienId: string;
  type: TypePret;
  montantEmprunte: number;
  tauxAnnuel: number;
  /**
   * When differeInclus is true (default): total duration INCLUDING the defer.
   * When differeInclus is false: AMORTIZATION duration, defer is added on top.
   */
  dureeAnnees: number;
  dateDebut: string;
  assuranceAnnuelle: number;
  banque?: string;
  documents?: PieceJointePret[];
  /**
   * True once the user has confirmed that the pret reflects a real bank offer
   * (and not just a simulation). Drives the "Theorique"/"Reel" label on the
   * Credit section in pre-acte biens.
   */
  offerValidated?: boolean;
  /** Number of months of defer at the start of the pret (0 = no defer). */
  differeMois?: number;
  /** Defer type — only meaningful if differeMois > 0. */
  differeType?: TypeDiffere;
  /**
   * - true (default): dureeAnnees includes the defer period.
   *   e.g. 6 mois differe + 20 ans → amortissement = 19 ans 6 mois.
   * - false: dureeAnnees = pure amortization, defer adds extra time.
   *   e.g. 6 mois differe + 20 ans → duree totale = 20 ans 6 mois.
   */
  differeInclus?: boolean;
  /**
   * Date limite (YYYY-MM-DD) jusqu'a laquelle l'enveloppe travaux du credit
   * peut etre consommee. Par defaut = dateDebut + differeMois.
   * Apres cette date, les nouveaux travaux ne peuvent plus etre finances par le credit.
   */
  enveloppeTravauxFinDate?: string;
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

export interface PieceJointe {
  id: string;
  nom: string;
  type: string;
  taille: number;
  data: string;
  ajouteLe: string;
}

export type CleEvolution =
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

export interface EntreesCalculateur {
  // Identity — persistent unique ID; when present, saving overwrites the existing simulation
  id?: string;

  // Meta
  nomSimulation: string;
  adresse: string;
  /** Type de bien (appartement / maison / immeuble). Default: "appartement". */
  type: TypeBien;
  /** Date de saisie / acquisition (YYYY-MM-DD). Default: today. */
  dateSaisie: string;

  // Photo
  photo: string; // base64 data URI

  // Acquisition
  prixAchat: number;
  fraisNotairePct: number;
  fraisAgence: number;
  surfaceM2: number;
  fraisDossier: number;
  fraisCourtage: number;
  fraisGarantie: number;
  montantTravaux: number;
  lotsTravaux: LotTravaux[];
  lotsMobilier: LotMobilier[];
  montantMobilierTotal: number; // computed total

  // Notes
  pointsNotables: string;
  attachments: PieceJointe[];

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
  typePret: TypePret;
  assurancePretMode: ModeAssurancePret;
  assurancePretAnnuelle: number;
  assurancePretPct: number;
  differePretMois: number;
  /** true (default): differe inclus dans dureeCredit. false: differe en plus. */
  differePretInclus: boolean;
  differeLoyer: number;

  // Evolutions annuelles (% d'augmentation par an, ex: 0.05 = +5%/an)
  evolutions: Partial<Record<CleEvolution, number>>;

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
  regimeFiscal: RegimeFiscal;
  trancheMarginalePct?: number;
  amortissementImmobilierPct?: number;
  amortissementTravauxPct?: number;
  amortissementMobilierPct?: number;
  montantMobilier?: number;

  // Projection
  tauxAppreciation: number;
  dureeDetention: number;
}

export interface ProjectionAnnuelle {
  annee: number;
  loyerBrut: number;
  loyerNet: number;
  charges: number;
  interets: number;
  assurancePret: number;
  amortissement: number;
  capitalRembourse: number;
  mensualitesCredit: number;
  cashFlowAvantImpot: number;
  impot: number;
  cashFlowApresImpot: number;
  capitalRestantDu: number;
  valeurBien: number;
  plusValue: number;
}

export interface ResultatsCalculateur {
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
  projection: ProjectionAnnuelle[];
}

export interface SnapshotSimulation {
  inputs: EntreesCalculateur;
  savedAt: string;
}

export interface SimulationSauvegardee {
  id: string;
  nom: string;
  inputs: EntreesCalculateur;
  savedAt: string;
  /** Previous versions of this simulation (most recent first). Capped to keep storage reasonable. */
  history?: SnapshotSimulation[];
}

export interface Associe {
  id: string;
  nom: string;
  quotePart: number; // percentage, e.g. 50 = 50%
}

export interface ParametresApp {
  regimeFiscal: RegimeFiscal;
  nomSCI: string;
  siren?: string;
  adresseSiege?: string;
  capitalSocial?: number;
  associes: Associe[];
  seuilAlerteTresorerie?: number;
  googleClientId?: string;
  /** Drive folder ID chosen by the user via the Picker. If unset, saves at Drive root. */
  googleDriveFolderId?: string;
  /** Display name of the chosen folder (for UI only). */
  googleDriveFolderName?: string;
}

// --- Charge payments (budget vs reel) ---

export type StatutPaiementCharge = 'paye' | 'partiel' | 'en_attente';

export const STATUT_PAIEMENT_CHARGE_LABELS: Record<StatutPaiementCharge, string> = {
  paye: 'Paye',
  partiel: 'Partiel',
  en_attente: 'En attente',
};

export interface PaiementCharge {
  id: string;
  /** Linked recurring depense */
  depenseId: string;
  bienId: string;
  /** "YYYY-MM" for mensuel, "YYYY-Q1".."YYYY-Q4" for trimestriel, "YYYY" for annuel */
  periode: string;
  montantAttendu: number;
  montantPaye: number;
  statut: StatutPaiementCharge;
  datePaiement?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonneesApp {
  biens: Bien[];
  depenses: Depense[];
  revenus: Revenu[];
  prets: Pret[];
  interventions: Intervention[];
  contacts: Contact[];
  documents: DocumentBien[];
  lots: Lot[];
  suiviLoyers: SuiviMensuelLoyer[];
  paiementsCharges: PaiementCharge[];
  settings: ParametresApp;
}

export const TYPE_BIEN_LABELS: Record<TypeBien, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  parking: 'Parking',
};

export const CATEGORIE_DEPENSE_LABELS: Record<CategorieDepense, string> = {
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

export const CATEGORIE_REVENU_LABELS: Record<CategorieRevenu, string> = {
  loyer: 'Loyer',
  parking: 'Parking',
  charges_recuperees: 'Charges recuperees',
  autre: 'Autre',
};

export const FREQUENCY_LABELS: Record<FrequenceDepense, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  ponctuel: 'Ponctuel',
};

export const DEPENSE_GROUPS: Record<string, CategorieDepense[]> = {
  'Charges fixes': ['credit', 'taxe_fonciere', 'assurance_pno', 'gestion_locative', 'copropriete'],
  'Charges variables': ['reparations', 'charges_locatives', 'vacance'],
  'Ponctuelles': ['frais_notaire', 'travaux', 'ameublement', 'autre'],
};
