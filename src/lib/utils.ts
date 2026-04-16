import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { FrequenceDepense, FrequenceRevenu } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, withCents = false): string {
  return withCents ? currencyFormatterCents.format(value) : currencyFormatter.format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)} %`;
}

export function annualiserMontant(montant: number, frequence: FrequenceDepense | FrequenceRevenu): number {
  switch (frequence) {
    case 'mensuel': return montant * 12;
    case 'trimestriel': return montant * 4;
    case 'annuel': return montant;
    case 'ponctuel': return 0;
  }
}

export function mensualiserMontant(montant: number, frequence: FrequenceDepense | FrequenceRevenu): number {
  switch (frequence) {
    case 'mensuel': return montant;
    case 'trimestriel': return montant / 3;
    case 'annuel': return montant / 12;
    case 'ponctuel': return 0;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function coutTotalBien(p: {
  prixAchat: number;
  fraisNotaire: number;
  fraisAgence?: number;
  fraisDossier?: number;
  fraisCourtage?: number;
  montantTravaux: number;
  montantMobilier?: number;
  allocationCredit?: { bien: number; travaux: number; notaire: number; agence: number; dossier?: number; garantie?: number; mobilier?: number; autre: number };
}): number {
  // When the user has customized the allocation buckets, those become the
  // source of truth for the project cost — the static property fields are
  // only historical defaults.
  if (p.allocationCredit) {
    const a = p.allocationCredit;
    // Backfill mobilier : bucket ajoute en 2026, les allocations plus
    // anciennes ne l'ont pas. On fallback sur property.montantMobilier
    // pour que le cout total reste coherent tant que l'utilisateur n'a
    // pas explicitement edite son allocation.
    const mobilier = a.mobilier ?? p.montantMobilier ?? 0;
    return a.bien + a.travaux + a.notaire + a.agence + (a.dossier ?? 0) + (a.garantie ?? 0) + mobilier + a.autre;
  }
  return p.prixAchat + p.fraisNotaire + (p.fraisAgence ?? 0) + (p.fraisDossier ?? 0) + (p.fraisCourtage ?? 0) + p.montantTravaux + (p.montantMobilier ?? 0);
}

/**
 * Date de fin de disponibilite de l'enveloppe travaux.
 * Si explicitement definie → la retourne.
 * Sinon → dateDebut du pret + differeMois (la duree du differe).
 * Si pas de differe → null (pas de fenetre par defaut).
 */
export function enveloppeTravauxFinDate(loan: {
  dateDebut: string;
  differeMois?: number;
  enveloppeTravauxFinDate?: string;
}): string | null {
  if (loan.enveloppeTravauxFinDate) return loan.enveloppeTravauxFinDate;
  const dM = loan.differeMois ?? 0;
  if (dM <= 0) return null;
  const d = new Date(loan.dateDebut);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + dM);
  return d.toISOString().slice(0, 10);
}

/** True si l'enveloppe travaux est encore ouverte aujourd'hui. */
export function isEnveloppeTravauxOuverte(loan: {
  dateDebut: string;
  differeMois?: number;
  enveloppeTravauxFinDate?: string;
}): boolean {
  const fin = enveloppeTravauxFinDate(loan);
  if (!fin) return true; // pas de fenetre = toujours ouvert
  return new Date().toISOString().slice(0, 10) <= fin;
}

/**
 * Returns the effective acquisition date of a property.
 * Priority: statusDates.acte > earliest statusDate > dateSaisie > createdAt
 * dateSaisie is the date the property was entered in the app (not the real purchase date).
 */
/**
 * Facteur pro-rata (0..1) pour l'annee d'acquisition d'un bien.
 * Utilise pour la taxe fonciere : l'annee de signature de l'acte, la taxe
 * est due au prorata des jours restants (acheteur & vendeur se repartissent
 * la taxe selon les jours possedes).
 * - Annee avant l'acte      → 0
 * - Annee de l'acte         → (jours_acte_vers_31_dec) / jours_annee
 * - Annee apres l'acte      → 1
 * - Pas d'acte defini       → 1 (comportement legacy)
 */
export function prorataPremiereAnneeFactor(acteDate: string | undefined, annee: number): number {
  if (!acteDate) return 1;
  const acte = new Date(acteDate);
  if (isNaN(acte.getTime())) return 1;
  if (annee < acte.getFullYear()) return 0;
  if (annee > acte.getFullYear()) return 1;
  const endOfYear = new Date(annee, 11, 31);
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(1, Math.round((endOfYear.getTime() - acte.getTime()) / msPerDay) + 1);
  const isLeap = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
  const yearDays = isLeap ? 366 : 365;
  return Math.min(1, days / yearDays);
}

export function getPropertyAcquisitionDate(p: { dateSaisie?: string; statusDates?: Partial<Record<string, string>>; createdAt?: string }): string {
  // statusDates.acte = actual signing date (best source)
  if (p.statusDates?.acte) return p.statusDates.acte;
  // Earliest statusDate (prospection, offre, compromis, etc.)
  if (p.statusDates) {
    const dates = Object.values(p.statusDates).filter(Boolean).sort();
    if (dates.length > 0) return dates[0]!;
  }
  // Fallback to dateSaisie (entry date) then createdAt
  if (p.dateSaisie) return p.dateSaisie;
  return p.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo

/** Returns true if file is within size limit. Shows a toast and returns false otherwise. */
export function checkFileSize(file: File): boolean {
  if (file.size <= MAX_FILE_SIZE) return true;
  const sizeMo = (file.size / (1024 * 1024)).toFixed(1);
  // Dynamic import to avoid pulling sonner into non-UI code
  import('sonner').then(({ toast }) => {
    toast.error(`Fichier trop volumineux (${sizeMo} Mo)`, {
      description: `La limite est de ${MAX_FILE_SIZE / (1024 * 1024)} Mo. Reduisez la taille du fichier.`,
    });
  });
  return false;
}
