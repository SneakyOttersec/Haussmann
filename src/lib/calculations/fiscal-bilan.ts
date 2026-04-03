import type { AppData, Property } from "@/types";
import { annualiserMontant } from "@/lib/utils";
import { interetsAnnuels } from "./loan";
import { calculerImpotIR } from "./tax-ir";
import { calculerImpotIS } from "./tax-is";

export interface BilanPropertyRow {
  propertyId: string;
  propertyNom: string;
  revenusLocatifs: number;
  chargesDeductibles: number;
  interetsEmprunt: number;
  assuranceEmprunt: number;
  amortissements: number;
  resultatFiscal: number;
  impotEstime: number;
}

export interface BilanFiscalAnnuel {
  annee: number;
  regime: "IR" | "IS";
  rows: BilanPropertyRow[];
  totaux: BilanPropertyRow;
}

function isActiveInYear(dateDebut: string, dateFin: string | undefined, year: number): boolean {
  const start = new Date(dateDebut);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  if (start > yearEnd) return false;
  if (dateFin) {
    const end = new Date(dateFin);
    if (end < yearStart) return false;
  }
  return true;
}

function computeAmortissement(p: Property, annee: number): number {
  // Simplified IS amortissement: bien/25 + travaux/18 + mobilier/7
  const amortBien = (p.prixAchat * 0.8) / 25;
  const amortTravaux = p.montantTravaux / 18;
  const amortMobilier = (p.montantMobilier ?? 0) / 7;

  // Check if still within amortissement period
  const purchaseYear = parseInt(p.dateAchat?.slice(0, 4) ?? "2024");
  const yearsOwned = annee - purchaseYear + 1;

  let total = 0;
  if (yearsOwned <= 25) total += amortBien;
  if (yearsOwned <= 18) total += amortTravaux;
  if (yearsOwned <= 7) total += amortMobilier;

  return Math.round(total);
}

export function computeBilanFiscal(data: AppData, annee: number): BilanFiscalAnnuel {
  const regime = data.settings.regimeFiscal;
  const tmi = 0.30; // default TMI

  const rows: BilanPropertyRow[] = data.properties.map((p) => {
    // Revenus
    const revenus = data.incomes
      .filter((i) => i.propertyId === p.id && isActiveInYear(i.dateDebut, i.dateFin, annee) && i.frequence !== "ponctuel")
      .reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);

    // Charges deductibles (hors credit)
    const charges = data.expenses
      .filter((e) => e.propertyId === p.id && e.categorie !== "credit" && isActiveInYear(e.dateDebut, e.dateFin, annee) && e.frequence !== "ponctuel")
      .reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);

    // Interets & assurance emprunt
    const loan = data.loans.find((l) => l.propertyId === p.id);
    let interets = 0, assurance = 0;
    if (loan) {
      const loanStartYear = parseInt(loan.dateDebut.slice(0, 4));
      const loanAnnee = annee - loanStartYear + 1;
      if (loanAnnee >= 1 && loanAnnee <= loan.dureeAnnees) {
        interets = interetsAnnuels(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees, loanAnnee, loan.type);
        assurance = loan.assuranceAnnuelle;
      }
    }

    // Amortissements (IS only)
    const amort = regime === "IS" ? computeAmortissement(p, annee) : 0;

    const resultat = revenus - charges - interets - assurance - amort;
    const impot = regime === "IR"
      ? calculerImpotIR(resultat, tmi)
      : calculerImpotIS(Math.max(0, resultat));

    return {
      propertyId: p.id,
      propertyNom: p.nom,
      revenusLocatifs: Math.round(revenus),
      chargesDeductibles: Math.round(charges),
      interetsEmprunt: Math.round(interets),
      assuranceEmprunt: Math.round(assurance),
      amortissements: amort,
      resultatFiscal: Math.round(resultat),
      impotEstime: Math.round(impot),
    };
  });

  const totaux: BilanPropertyRow = {
    propertyId: "",
    propertyNom: "TOTAL",
    revenusLocatifs: rows.reduce((s, r) => s + r.revenusLocatifs, 0),
    chargesDeductibles: rows.reduce((s, r) => s + r.chargesDeductibles, 0),
    interetsEmprunt: rows.reduce((s, r) => s + r.interetsEmprunt, 0),
    assuranceEmprunt: rows.reduce((s, r) => s + r.assuranceEmprunt, 0),
    amortissements: rows.reduce((s, r) => s + r.amortissements, 0),
    resultatFiscal: rows.reduce((s, r) => s + r.resultatFiscal, 0),
    impotEstime: 0,
  };
  // Recalculate tax on consolidated result for IS
  totaux.impotEstime = regime === "IR"
    ? rows.reduce((s, r) => s + r.impotEstime, 0)
    : calculerImpotIS(Math.max(0, totaux.resultatFiscal));

  return { annee, regime, rows, totaux };
}

export function getAvailableYears(data: AppData): number[] {
  const now = new Date().getFullYear();
  const dates = [
    ...data.properties.map((p) => parseInt(p.dateAchat?.slice(0, 4) ?? String(now))),
    ...data.incomes.map((i) => parseInt(i.dateDebut.slice(0, 4))),
  ].filter((y) => y > 2000 && y <= now);
  const minYear = dates.length > 0 ? Math.min(...dates) : now;
  const years: number[] = [];
  for (let y = now; y >= minYear; y--) years.push(y);
  return years;
}
