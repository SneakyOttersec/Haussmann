import type { TypePret, TypeDiffere } from '@/types';
import { round2 } from '@/lib/round';

export function calculerMensualiteAmortissable(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number
): number {
  if (capital <= 0 || dureeAnnees <= 0) return 0;
  if (tauxAnnuel <= 0) return round2(capital / (dureeAnnees * 12));
  const t = tauxAnnuel / 12;
  const n = dureeAnnees * 12;
  return round2(capital * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1));
}

export function calculerMensualiteInFine(
  capital: number,
  tauxAnnuel: number
): number {
  if (capital <= 0) return 0;
  return round2(capital * tauxAnnuel / 12);
}

export function calculerMensualite(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number,
  type: TypePret
): number {
  if (type === 'in_fine') return calculerMensualiteInFine(capital, tauxAnnuel);
  return calculerMensualiteAmortissable(capital, tauxAnnuel, dureeAnnees);
}

export function capitalRestantDu(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number,
  anneeEcoulee: number,
  type: TypePret
): number {
  if (type === 'in_fine') return anneeEcoulee >= dureeAnnees ? 0 : capital;
  if (tauxAnnuel <= 0) {
    const reste = capital - (capital / dureeAnnees) * anneeEcoulee;
    return Math.max(0, reste);
  }
  const t = tauxAnnuel / 12;
  const n = dureeAnnees * 12;
  const moisEcoules = anneeEcoulee * 12;
  const mensualite = calculerMensualiteAmortissable(capital, tauxAnnuel, dureeAnnees);
  const crd = capital * Math.pow(1 + t, moisEcoules) - mensualite * ((Math.pow(1 + t, moisEcoules) - 1) / t);
  return round2(Math.max(0, crd));
}

export function interetsAnnuels(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number,
  annee: number,
  type: TypePret
): number {
  if (type === 'in_fine') return capital * tauxAnnuel;
  const crdDebut = annee === 1 ? capital : capitalRestantDu(capital, tauxAnnuel, dureeAnnees, annee - 1, type);
  const crdFin = capitalRestantDu(capital, tauxAnnuel, dureeAnnees, annee, type);
  const mensualite = calculerMensualiteAmortissable(capital, tauxAnnuel, dureeAnnees);
  const totalPaye = mensualite * 12;
  const capitalRembourse = crdDebut - crdFin;
  return round2(Math.max(0, totalPaye - capitalRembourse));
}

// ── Differe-aware helpers ──
//
// Loans can include a "differe" period at the start:
// - "partiel": only interest is paid each month (capital is untouched)
// - "total":   nothing is paid; interest is capitalized into the principal
// After the defer period, the pret amortizes normally over the remaining months
// on the post-defer principal (which equals the original capital for partial,
// or the inflated capital for total).
//
// `dureeAnnees` represents the TOTAL pret duration, including the defer period.

export interface PretLike {
  montantEmprunte: number;
  tauxAnnuel: number;
  /** When differeInclus is true (default): total duration INCLUDING the defer.
   *  When differeInclus is false: AMORTIZATION duration only, defer is added on top. */
  dureeAnnees: number;
  type: TypePret;
  differeMois?: number;
  differeType?: TypeDiffere;
  /**
   * - true (default): dureeAnnees includes the defer period.
   *   e.g. 20 ans + 6 mois differe → amortissement = 19 ans 6 mois.
   * - false: dureeAnnees = pure amortization, defer adds extra time.
   *   e.g. 20 ans + 6 mois differe → duree totale = 20 ans 6 mois.
   */
  differeInclus?: boolean;
}

const tauxMensuel = (l: PretLike): number => l.tauxAnnuel / 12;
const moisDiffere = (l: PretLike): number => Math.max(0, l.differeMois ?? 0);

/** Total duration of the pret in months (defer + amortization). */
const totalMois = (l: PretLike): number => {
  const dM = moisDiffere(l);
  if (dM <= 0) return l.dureeAnnees * 12;
  // differeInclus === false (or undefined with no defer) → defer adds extra time
  if (l.differeInclus === false) return l.dureeAnnees * 12 + dM;
  // default (inclus) → dureeAnnees already covers defer + amortization
  return l.dureeAnnees * 12;
};

/** Number of months in the amortization phase (after the defer). */
const moisAmortissables = (l: PretLike): number => {
  const dM = moisDiffere(l);
  if (dM <= 0) return l.dureeAnnees * 12;
  // differeInclus === false → full stated duration is amortization
  if (l.differeInclus === false) return l.dureeAnnees * 12;
  // default (inclus) → subtract defer from the total
  return Math.max(0, l.dureeAnnees * 12 - dM);
};

/**
 * Capital effectif au debut de la phase d'amortissement.
 * - Sans differe / partiel: = montantEmprunte (les interets ont ete payes)
 * - Differe total: = montantEmprunte * (1 + t)^N (interets capitalises)
 */
export function capitalApresDiffere(pret: PretLike): number {
  const dM = moisDiffere(pret);
  if (dM <= 0) return pret.montantEmprunte;
  if (pret.differeType === 'total') {
    return round2(pret.montantEmprunte * Math.pow(1 + tauxMensuel(pret), dM));
  }
  return pret.montantEmprunte;
}

/**
 * Mensualite (hors assurance) durant la phase d'amortissement, apres differe.
 * Calcul standard sur le capital effectif et la duree restante.
 */
export function mensualiteAmortissement(pret: PretLike): number {
  if (pret.type === 'in_fine') {
    return round2(pret.montantEmprunte * pret.tauxAnnuel / 12);
  }
  const capital = capitalApresDiffere(pret);
  const n = moisAmortissables(pret);
  if (capital <= 0 || n <= 0) return 0;
  if (pret.tauxAnnuel <= 0) return round2(capital / n);
  const t = tauxMensuel(pret);
  return round2(capital * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1));
}

/**
 * Mensualite payee pendant le differe :
 * - partiel: interets uniquement = capital * (taux/12)
 * - total:   0 (interets capitalises, rien n'est paye)
 */
export function mensualitePendantDiffere(pret: PretLike): number {
  if (moisDiffere(pret) <= 0) return 0;
  if (pret.differeType === 'total') return 0;
  return round2(pret.montantEmprunte * pret.tauxAnnuel / 12);
}

/**
 * Mensualite (hors assurance) au mois `monthIdx` (0-indexed depuis le debut du pret).
 */
export function mensualiteAuMois(pret: PretLike, monthIdx: number): number {
  if (monthIdx < 0 || monthIdx >= totalMois(pret)) return 0;
  if (monthIdx < moisDiffere(pret)) return mensualitePendantDiffere(pret);
  return mensualiteAmortissement(pret);
}

/**
 * Capital restant du a la fin du mois `monthIdx` (0-indexed depuis le debut).
 * Tient compte du differe (partiel ou total).
 */
export function crdAuMois(pret: PretLike, monthIdx: number): number {
  if (monthIdx < 0) return pret.montantEmprunte;
  // After the pret ends, the CRD is exactly zero (avoid the ~1 EUR rounding tail
  // accumulated by hundreds of floating-point ops).
  if (monthIdx >= totalMois(pret) - 1) return 0;
  if (pret.type === 'in_fine') return pret.montantEmprunte;

  const t = tauxMensuel(pret);
  const dM = moisDiffere(pret);

  // Phase de differe
  if (monthIdx < dM) {
    if (pret.differeType === 'total') {
      return round2(pret.montantEmprunte * Math.pow(1 + t, monthIdx + 1));
    }
    return pret.montantEmprunte; // partiel: capital constant
  }

  // Phase d'amortissement
  const capital = capitalApresDiffere(pret);
  const moisDansAmort = monthIdx - dM + 1; // 1-based
  const n = moisAmortissables(pret);
  if (n <= 0) return 0;
  if (pret.tauxAnnuel <= 0) {
    return round2(Math.max(0, capital - (capital / n) * moisDansAmort));
  }
  const mensualite = mensualiteAmortissement(pret);
  const crd = capital * Math.pow(1 + t, moisDansAmort) - mensualite * ((Math.pow(1 + t, moisDansAmort) - 1) / t);
  return round2(Math.max(0, crd));
}

/**
 * Interets EFFECTIVEMENT PAYES pendant l'annee (1-based).
 * Pour la deductibilite fiscale : les interets capitalises pendant un differe
 * total ne sont pas consideres comme payes — donc non deductibles cette annee-la.
 */
export function interetsAnneePret(pret: PretLike, annee: number): number {
  const dureeReelleAnnees = Math.ceil(totalMois(pret) / 12);
  if (annee < 1 || annee > dureeReelleAnnees) return 0;

  const moisDebut = (annee - 1) * 12;
  const moisFin = annee * 12 - 1;
  const dM = moisDiffere(pret);
  let totalInterets = 0;

  // In_fine: interest is paid every month the pret is active (no amortization).
  // But during a differe total, nothing is paid at all → 0 deductible interest.
  if (pret.type === 'in_fine') {
    for (let m = moisDebut; m <= moisFin && m < totalMois(pret); m++) {
      if (m < dM && pret.differeType === 'total') continue; // capitalized, not paid
      totalInterets += pret.montantEmprunte * pret.tauxAnnuel / 12;
    }
    return round2(totalInterets);
  }

  for (let m = moisDebut; m <= moisFin && m < totalMois(pret); m++) {
    if (m < dM) {
      // Phase differe
      if (pret.differeType === 'partiel') {
        totalInterets += pret.montantEmprunte * pret.tauxAnnuel / 12;
      }
      // total: rien n'est paye, rien n'est deductible
    } else {
      // Phase amortissement: interets = mensualite - capital rembourse
      const crdAvant = m === 0 ? pret.montantEmprunte : crdAuMois(pret, m - 1);
      const crdApres = crdAuMois(pret, m);
      const mensualite = mensualiteAmortissement(pret);
      const capitalRembourse = crdAvant - crdApres;
      totalInterets += Math.max(0, mensualite - capitalRembourse);
    }
  }
  return round2(totalInterets);
}

/**
 * Total des mensualites (hors assurance) payees pendant l'annee (1-based).
 * Utile pour le cash flow annuel et le bilan.
 */
export function totalMensualitesAnnee(pret: PretLike, annee: number): number {
  if (annee < 1) return 0;
  let total = 0;
  const moisDebut = (annee - 1) * 12;
  const moisFin = annee * 12 - 1;
  for (let m = moisDebut; m <= moisFin && m < totalMois(pret); m++) {
    total += mensualiteAuMois(pret, m);
  }
  return round2(total);
}

/**
 * Total pret duration in months (defer + amortization). Exported so that
 * call sites don't have to duplicate the differeInclus logic.
 */
export function dureeTotaleMoisPret(pret: PretLike): number {
  return totalMois(pret);
}

/**
 * CRD a la fin de l'annee N (1-based). Wrapper sur crdAuMois pour les callers
 * qui raisonnent en annees plutot qu'en mois.
 */
export function crdEnFinAnnee(pret: PretLike, annee: number): number {
  if (annee <= 0) return pret.montantEmprunte;
  const m = annee * 12 - 1;
  return crdAuMois(pret, Math.min(m, totalMois(pret) - 1));
}
