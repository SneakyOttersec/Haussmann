import type { LoanType } from '@/types';

export function calculerMensualiteAmortissable(
  capital: number,
  tauxAnnuel: number,
  dureeAnnees: number
): number {
  if (capital <= 0 || dureeAnnees <= 0) return 0;
  if (tauxAnnuel <= 0) return capital / (dureeAnnees * 12);
  const t = tauxAnnuel / 12;
  const n = dureeAnnees * 12;
  return capital * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
}

export function calculerMensualiteInFine(
  capital: number,
  tauxAnnuel: number
): number {
  if (capital <= 0) return 0;
  return capital * tauxAnnuel / 12;
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
  return Math.max(0, crd);
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
  return Math.max(0, totalPaye - capitalRembourse);
}
