import type { LoanType, DifferType } from '@/types';
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
  type: LoanType
): number {
  if (type === 'in_fine') return calculerMensualiteInFine(capital, tauxAnnuel);
  return calculerMensualiteAmortissable(capital, tauxAnnuel, dureeAnnees);
}

export function capitalRestantDu(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number,
  anneeEcoulee: number,
  type: LoanType
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
  type: LoanType
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
// After the defer period, the loan amortizes normally over the remaining months
// on the post-defer principal (which equals the original capital for partial,
// or the inflated capital for total).
//
// `dureeAnnees` represents the TOTAL loan duration, including the defer period.

export interface LoanLike {
  montantEmprunte: number;
  tauxAnnuel: number;
  dureeAnnees: number;
  type: LoanType;
  differeMois?: number;
  differeType?: DifferType;
}

const tauxMensuel = (l: LoanLike): number => l.tauxAnnuel / 12;
const totalMois = (l: LoanLike): number => l.dureeAnnees * 12;
const moisDiffere = (l: LoanLike): number => Math.max(0, l.differeMois ?? 0);
const moisAmortissables = (l: LoanLike): number => Math.max(0, totalMois(l) - moisDiffere(l));

/**
 * Capital effectif au debut de la phase d'amortissement.
 * - Sans differe / partiel: = montantEmprunte (les interets ont ete payes)
 * - Differe total: = montantEmprunte * (1 + t)^N (interets capitalises)
 */
export function capitalApresDiffere(loan: LoanLike): number {
  const dM = moisDiffere(loan);
  if (dM <= 0) return loan.montantEmprunte;
  if (loan.differeType === 'total') {
    return round2(loan.montantEmprunte * Math.pow(1 + tauxMensuel(loan), dM));
  }
  return loan.montantEmprunte;
}

/**
 * Mensualite (hors assurance) durant la phase d'amortissement, apres differe.
 * Calcul standard sur le capital effectif et la duree restante.
 */
export function mensualiteAmortissement(loan: LoanLike): number {
  if (loan.type === 'in_fine') {
    return round2(loan.montantEmprunte * loan.tauxAnnuel / 12);
  }
  const capital = capitalApresDiffere(loan);
  const n = moisAmortissables(loan);
  if (capital <= 0 || n <= 0) return 0;
  if (loan.tauxAnnuel <= 0) return round2(capital / n);
  const t = tauxMensuel(loan);
  return round2(capital * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1));
}

/**
 * Mensualite payee pendant le differe :
 * - partiel: interets uniquement = capital * (taux/12)
 * - total:   0 (interets capitalises, rien n'est paye)
 */
export function mensualitePendantDiffere(loan: LoanLike): number {
  if (moisDiffere(loan) <= 0) return 0;
  if (loan.differeType === 'total') return 0;
  return round2(loan.montantEmprunte * loan.tauxAnnuel / 12);
}

/**
 * Mensualite (hors assurance) au mois `monthIdx` (0-indexed depuis le debut du pret).
 */
export function mensualiteAtMonth(loan: LoanLike, monthIdx: number): number {
  if (monthIdx < 0 || monthIdx >= totalMois(loan)) return 0;
  if (monthIdx < moisDiffere(loan)) return mensualitePendantDiffere(loan);
  return mensualiteAmortissement(loan);
}

/**
 * Capital restant du a la fin du mois `monthIdx` (0-indexed depuis le debut).
 * Tient compte du differe (partiel ou total).
 */
export function crdAtMonth(loan: LoanLike, monthIdx: number): number {
  if (monthIdx < 0) return loan.montantEmprunte;
  // After the loan ends, the CRD is exactly zero (avoid the ~1 EUR rounding tail
  // accumulated by hundreds of floating-point ops).
  if (monthIdx >= totalMois(loan) - 1) return 0;
  if (loan.type === 'in_fine') return loan.montantEmprunte;

  const t = tauxMensuel(loan);
  const dM = moisDiffere(loan);

  // Phase de differe
  if (monthIdx < dM) {
    if (loan.differeType === 'total') {
      return round2(loan.montantEmprunte * Math.pow(1 + t, monthIdx + 1));
    }
    return loan.montantEmprunte; // partiel: capital constant
  }

  // Phase d'amortissement
  const capital = capitalApresDiffere(loan);
  const moisDansAmort = monthIdx - dM + 1; // 1-based
  const n = moisAmortissables(loan);
  if (n <= 0) return 0;
  if (loan.tauxAnnuel <= 0) {
    return round2(Math.max(0, capital - (capital / n) * moisDansAmort));
  }
  const mensualite = mensualiteAmortissement(loan);
  const crd = capital * Math.pow(1 + t, moisDansAmort) - mensualite * ((Math.pow(1 + t, moisDansAmort) - 1) / t);
  return round2(Math.max(0, crd));
}

/**
 * Interets EFFECTIVEMENT PAYES pendant l'annee (1-based).
 * Pour la deductibilite fiscale : les interets capitalises pendant un differe
 * total ne sont pas consideres comme payes — donc non deductibles cette annee-la.
 */
export function interetsAnneeForLoan(loan: LoanLike, annee: number): number {
  if (annee < 1 || annee > loan.dureeAnnees) return 0;
  if (loan.type === 'in_fine') return round2(loan.montantEmprunte * loan.tauxAnnuel);

  const moisDebut = (annee - 1) * 12;
  const moisFin = annee * 12 - 1;
  const dM = moisDiffere(loan);
  let totalInterets = 0;

  for (let m = moisDebut; m <= moisFin && m < totalMois(loan); m++) {
    if (m < dM) {
      // Phase differe
      if (loan.differeType === 'partiel') {
        totalInterets += loan.montantEmprunte * loan.tauxAnnuel / 12;
      }
      // total: rien n'est paye, rien n'est deductible
    } else {
      // Phase amortissement: interets = mensualite - capital rembourse
      const crdAvant = m === 0 ? loan.montantEmprunte : crdAtMonth(loan, m - 1);
      const crdApres = crdAtMonth(loan, m);
      const mensualite = mensualiteAmortissement(loan);
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
export function totalMensualitesAnnee(loan: LoanLike, annee: number): number {
  if (annee < 1) return 0;
  let total = 0;
  const moisDebut = (annee - 1) * 12;
  const moisFin = annee * 12 - 1;
  for (let m = moisDebut; m <= moisFin && m < totalMois(loan); m++) {
    total += mensualiteAtMonth(loan, m);
  }
  return round2(total);
}

/**
 * CRD a la fin de l'annee N (1-based). Wrapper sur crdAtMonth pour les callers
 * qui raisonnent en annees plutot qu'en mois.
 */
export function crdAtYearEnd(loan: LoanLike, annee: number): number {
  if (annee <= 0) return loan.montantEmprunte;
  const m = annee * 12 - 1;
  return crdAtMonth(loan, Math.min(m, totalMois(loan) - 1));
}
