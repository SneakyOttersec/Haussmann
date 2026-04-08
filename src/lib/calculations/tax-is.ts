import { IS_TAUX_REDUIT, IS_SEUIL_REDUIT, IS_TAUX_NORMAL } from '../constants';
import type { CalculatorInputs, LotTravaux } from '@/types';
import { AMORT_DUREES } from '@/types';
import { round2 } from '@/lib/round';

export function calculerImpotIS(resultatFiscal: number): number {
  if (resultatFiscal <= 0) return 0;
  if (resultatFiscal <= IS_SEUIL_REDUIT) {
    return round2(resultatFiscal * IS_TAUX_REDUIT);
  }
  return round2(IS_SEUIL_REDUIT * IS_TAUX_REDUIT + (resultatFiscal - IS_SEUIL_REDUIT) * IS_TAUX_NORMAL);
}

/**
 * Compute total amortissement for a given year, with each component
 * having its own duration. After the duration, that component stops.
 */
export function calculerAmortissementAnnee(
  inputs: CalculatorInputs,
  fraisNotaire: number,
  annee: number,
): number {
  let total = 0;

  // 1. Bien (80% of prix achat) over 25 years
  const valeurBatiment = inputs.prixAchat * 0.80;
  if (annee <= AMORT_DUREES.bien) {
    total += valeurBatiment / AMORT_DUREES.bien;
  }

  // 2. Frais de notaire over 1 year
  if (annee <= AMORT_DUREES.notaire) {
    total += fraisNotaire / AMORT_DUREES.notaire;
  }

  // 3. Frais d'agence over 1 year
  if (inputs.fraisAgence > 0 && annee <= AMORT_DUREES.agence) {
    total += inputs.fraisAgence / AMORT_DUREES.agence;
  }

  // 4. Mobilier over 10 years
  const mobilierTotal = (inputs.lotsMobilier ?? []).reduce((s, l) => s + (l.montant || 0), 0);
  if (mobilierTotal > 0 && annee <= AMORT_DUREES.meubles) {
    total += mobilierTotal / AMORT_DUREES.meubles;
  }

  // 5. Travaux lots — each with its own duration
  const lotsTravaux: LotTravaux[] = inputs.lotsTravaux ?? [];
  for (const lot of lotsTravaux) {
    if (lot.montant > 0 && lot.dureeAmortissement > 0 && annee <= lot.dureeAmortissement) {
      total += lot.montant / lot.dureeAmortissement;
    }
  }

  // 6. Fallback: if no lotsTravaux but montantTravaux > 0, use 18 years default
  if (lotsTravaux.length === 0 && inputs.montantTravaux > 0 && annee <= 18) {
    total += inputs.montantTravaux / 18;
  }

  return round2(total);
}

// Keep old function for backward compat (not used in new code)
export function calculerAmortissement(
  prixAchat: number,
  fraisNotaire: number,
  montantTravaux: number,
  montantMobilier: number,
  tauxImmobilier: number,
  tauxTravaux: number,
  tauxMobilier: number
): number {
  const valeurBatiment = (prixAchat + fraisNotaire) * 0.80;
  return (valeurBatiment * tauxImmobilier) +
    (montantTravaux * tauxTravaux) +
    (montantMobilier * tauxMobilier);
}
