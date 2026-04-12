/**
 * Regles fiscales versionnees — facilite les mises a jour lors des lois de finances.
 * Pour mettre a jour : modifier l'annee et les valeurs correspondantes.
 */
export const FISCAL_RULES = {
  annee: 2024,
  prelevementsSociaux: 0.172,
  is: {
    tauxReduit: 0.15,
    seuilReduit: 42_500,
    tauxNormal: 0.25,
  },
  microFoncier: {
    seuil: 15_000,
    abattement: 0.30,
  },
  microBic: {
    seuil: 77_700,
    abattement: 0.50,
  },
  tmiTranches: [0, 0.11, 0.30, 0.41, 0.45] as readonly number[],
  fraisNotaire: {
    ancien: 0.08,
    neuf: 0.03,
  },
  pvParticulier: {
    abattementIR: { debut: 5, tauxAnnuel: 0.06, exoneration: 22 },
    abattementPS: { debut: 5, tauxAnnuel: 0.0165, annee22: 0.016, tauxApres22: 0.09, exoneration: 30 },
    tauxIR: 0.19,
  },
} as const;

// Backward-compatible individual exports
export const PRELEVEMENTS_SOCIAUX = FISCAL_RULES.prelevementsSociaux;
export const IS_TAUX_REDUIT = FISCAL_RULES.is.tauxReduit;
export const IS_SEUIL_REDUIT = FISCAL_RULES.is.seuilReduit;
export const IS_TAUX_NORMAL = FISCAL_RULES.is.tauxNormal;
export const FRAIS_NOTAIRE_ANCIEN = FISCAL_RULES.fraisNotaire.ancien;
export const FRAIS_NOTAIRE_NEUF = FISCAL_RULES.fraisNotaire.neuf;
export const TMI_TRANCHES = FISCAL_RULES.tmiTranches;
export const SEUIL_MICRO_FONCIER = FISCAL_RULES.microFoncier.seuil;
export const SEUIL_MICRO_BIC = FISCAL_RULES.microBic.seuil;
export const ABATTEMENT_MICRO_FONCIER = FISCAL_RULES.microFoncier.abattement;
export const ABATTEMENT_MICRO_BIC = FISCAL_RULES.microBic.abattement;

export const DEFAULT_CALCULATOR_INPUTS = {
  nomSimulation: '',
  adresse: '',
  pointsNotables: '',
  attachments: [],
  photo: '',
  prixAchat: 200000,
  fraisNotairePct: 0.08,
  fraisAgence: 0,
  surfaceM2: 0,
  fraisDossier: 0,
  fraisCourtage: 0,
  montantTravaux: 0,
  lotsTravaux: [],
  lotsMobilier: [],
  montantMobilierTotal: 0,
  lots: [{ id: '1', nom: 'Lot 1', loyerMensuel: 800 }],
  loyerMensuel: 800,
  autresRevenusAnnuels: 0,
  tauxVacance: 0.05,
  apportPersonnel: 16000,
  montantEmprunte: 200000,
  tauxCredit: 0.035,
  dureeCredit: 20,
  typePret: 'amortissable' as const,
  assurancePretMode: 'eur' as const,
  assurancePretAnnuelle: 700,
  assurancePretPct: 0.0034,
  differePretMois: 0,
  differePretInclus: true,
  differeLoyer: 0,
  chargesCopro: 1200,
  taxeFonciere: 1000,
  assurancePNO: 200,
  gestionLocativePct: 0,
  comptabilite: 0,
  cfeCrl: 0,
  entretien: 0,
  gli: 0,
  evolutions: { lopiloyer: 0.006 },
  autresChargesAnnuelles: 0,
  regimeFiscal: 'IR' as const,
  trancheMarginalePct: 0.30,
  amortissementImmobilierPct: 0.02,
  amortissementTravauxPct: 0.10,
  amortissementMobilierPct: 0.10,
  montantMobilier: 0,
  tauxAppreciation: 0.02,
  dureeDetention: 25,
};
