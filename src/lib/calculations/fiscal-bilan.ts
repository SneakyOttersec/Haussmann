import type { DonneesApp, Bien, EntreesCalculateur } from "@/types";
import { annualiserMontant, getPropertyAcquisitionDate, prorataPremiereAnneeFactor } from "@/lib/utils";
import { getMontantForYear } from "@/lib/expenseRevisions";
import { interetsAnneePret, dureeTotaleMoisPret } from "./loan";
import { calculerImpotIR } from "./tax-ir";
import { calculerImpotIS, calculerAmortissementAnnee } from "./tax-is";

export interface ChargesDetail {
  taxeFonciere: number;
  assurancePNO: number;
  travauxEntretien: number;
  fraisGestion: number;
  copropriete: number;
  autresCharges: number;
}

export interface BilanPropertyRow {
  propertyId: string;
  propertyNom: string;
  revenusLocatifs: number;
  chargesDeductibles: number;
  chargesDetail: ChargesDetail;
  interetsEmprunt: number;
  assuranceEmprunt: number;
  amortissements: number;
  /** Revenus - charges - interets - assurance (WITHOUT amortissement). Real cash impact. */
  cashFlowReel: number;
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

function propertyToAmortInputs(p: Bien): Pick<EntreesCalculateur, 'prixAchat' | 'fraisAgence' | 'montantTravaux' | 'lotsTravaux' | 'lotsMobilier'> {
  return {
    prixAchat: p.prixAchat,
    fraisAgence: p.fraisAgence ?? 0,
    montantTravaux: p.montantTravaux,
    lotsTravaux: [],
    lotsMobilier: (p.montantMobilier ?? 0) > 0
      ? [{ id: '0', nom: 'Mobilier', montant: p.montantMobilier ?? 0 }]
      : [],
  };
}

function computeAmortissement(p: Bien, fraisNotaire: number, annee: number): number {
  const purchaseYear = parseInt(getPropertyAcquisitionDate(p).slice(0, 4));
  const yearsOwned = annee - purchaseYear + 1;
  if (yearsOwned < 1) return 0;
  return Math.round(calculerAmortissementAnnee(
    propertyToAmortInputs(p) as EntreesCalculateur,
    fraisNotaire,
    yearsOwned,
  ));
}

export function computeBilanFiscal(data: DonneesApp, annee: number): BilanFiscalAnnuel {
  const regime = data.settings.regimeFiscal;
  const tmi = 0.30; // default TMI

  // Pre-index rent tracking by property+year
  const rentByPropYear = new Map<string, number>();
  for (const e of (data.rentTracking ?? [])) {
    if (e.yearMonth.startsWith(String(annee))) {
      const key = e.propertyId;
      rentByPropYear.set(key, (rentByPropYear.get(key) ?? 0) + e.loyerPercu);
    }
  }

  // Pre-index charge payments by expense+year.
  // Track both the sum AND the count of payment entries so we can detect
  // incomplete tracking and fall back to projection when needed.
  const chargePaidByExp = new Map<string, { total: number; count: number }>();
  for (const cp of (data.chargePayments ?? [])) {
    if (cp.periode.startsWith(String(annee))) {
      const prev = chargePaidByExp.get(cp.expenseId) ?? { total: 0, count: 0 };
      prev.total += cp.montantPaye;
      prev.count += 1;
      chargePaidByExp.set(cp.expenseId, prev);
    }
  }

  const rows: BilanPropertyRow[] = data.properties.map((p) => {
    // Revenus: use rent tracking (actual) for loyers, incomes for other revenue
    const loyersReels = rentByPropYear.get(p.id) ?? 0;
    const autresRevenus = data.incomes
      .filter((i) => i.propertyId === p.id && i.categorie !== "loyer" && isActiveInYear(i.dateDebut, i.dateFin, annee) && i.frequence !== "ponctuel")
      .reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);
    const revenus = loyersReels + autresRevenus;

    // Charges deductibles (hors credit) — with category breakdown
    // Use real payments when tracked, fallback to projection
    const propExpenses = data.expenses
      .filter((e) => e.propertyId === p.id && e.categorie !== "credit" && isActiveInYear(e.dateDebut, e.dateFin, annee) && e.frequence !== "ponctuel");

    const chargesDetail: ChargesDetail = { taxeFonciere: 0, assurancePNO: 0, travauxEntretien: 0, fraisGestion: 0, copropriete: 0, autresCharges: 0 };
    for (const e of propExpenses) {
      // Use real payments when the tracking is COMPLETE for the year.
      // "Complete" = the number of payment entries matches the expected
      // number of periods (12 for monthly, 4 for quarterly, 1 for annual).
      // If only partial entries exist, fall back to the projected amount
      // to avoid under-reporting charges in the fiscal bilan.
      const paid = chargePaidByExp.get(e.id);
      const expectedPeriods = e.frequence === "mensuel" ? 12
        : e.frequence === "trimestriel" ? 4
        : e.frequence === "annuel" ? 1
        : 0;
      const useRealPayments = paid != null && paid.count >= expectedPeriods;
      const montant = useRealPayments
        ? paid.total
        : annualiserMontant(getMontantForYear(e, annee), e.frequence);
      switch (e.categorie) {
        case 'taxe_fonciere': {
          // Pro-rata temporis pour l'annee d'acquisition : acheteur & vendeur
          // se partagent la taxe selon les jours de possession. Si acteDate
          // indefini ou annee differente, factor = 1 (pas d'effet).
          const factor = prorataPremiereAnneeFactor(p.statusDates?.acte, annee);
          chargesDetail.taxeFonciere += montant * factor;
          break;
        }
        case 'assurance_pno': chargesDetail.assurancePNO += montant; break;
        case 'reparations': case 'travaux': chargesDetail.travauxEntretien += montant; break;
        case 'gestion_locative': chargesDetail.fraisGestion += montant; break;
        case 'copropriete': chargesDetail.copropriete += montant; break;
        default: chargesDetail.autresCharges += montant; break;
      }
    }
    const charges = chargesDetail.taxeFonciere + chargesDetail.assurancePNO + chargesDetail.travauxEntretien
      + chargesDetail.fraisGestion + chargesDetail.copropriete + chargesDetail.autresCharges;

    // Interets & assurance emprunt
    const loan = data.loans.find((l) => l.propertyId === p.id);
    let interets = 0, assurance = 0;
    if (loan) {
      const loanStartYear = parseInt(loan.dateDebut.slice(0, 4));
      const loanAnnee = annee - loanStartYear + 1;
      const dureeReelleAnnees = Math.ceil(dureeTotaleMoisPret(loan) / 12);
      if (loanAnnee >= 1 && loanAnnee <= dureeReelleAnnees) {
        // Use the differe-aware helper: during a "differe total", interest is
        // capitalized (not paid → not deductible that year).
        interets = interetsAnneePret(loan, loanAnnee);
        assurance = loan.assuranceAnnuelle;
      }
    }

    // Amortissements (IS only)
    const pFraisNotaire = p.fraisNotaire ?? (p.prixAchat * 0.08);
    const amort = regime === "IS" ? computeAmortissement(p, pFraisNotaire, annee) : 0;

    const cfReel = revenus - charges - interets - assurance; // real cash impact (no amortissement)
    const resultat = cfReel - amort; // fiscal result (with amortissement)
    const impot = regime === "IR"
      ? calculerImpotIR(resultat, tmi)
      : calculerImpotIS(Math.max(0, resultat));

    return {
      propertyId: p.id,
      propertyNom: p.nom,
      revenusLocatifs: Math.round(revenus),
      chargesDeductibles: Math.round(charges),
      chargesDetail: {
        taxeFonciere: Math.round(chargesDetail.taxeFonciere),
        assurancePNO: Math.round(chargesDetail.assurancePNO),
        travauxEntretien: Math.round(chargesDetail.travauxEntretien),
        fraisGestion: Math.round(chargesDetail.fraisGestion),
        copropriete: Math.round(chargesDetail.copropriete),
        autresCharges: Math.round(chargesDetail.autresCharges),
      },
      interetsEmprunt: Math.round(interets),
      assuranceEmprunt: Math.round(assurance),
      amortissements: amort,
      cashFlowReel: Math.round(cfReel),
      resultatFiscal: Math.round(resultat),
      impotEstime: Math.round(impot),
    };
  });

  const sumDetail = (key: keyof ChargesDetail) => rows.reduce((s, r) => s + r.chargesDetail[key], 0);
  const totaux: BilanPropertyRow = {
    propertyId: "",
    propertyNom: "TOTAL",
    revenusLocatifs: rows.reduce((s, r) => s + r.revenusLocatifs, 0),
    chargesDeductibles: rows.reduce((s, r) => s + r.chargesDeductibles, 0),
    chargesDetail: {
      taxeFonciere: sumDetail('taxeFonciere'),
      assurancePNO: sumDetail('assurancePNO'),
      travauxEntretien: sumDetail('travauxEntretien'),
      fraisGestion: sumDetail('fraisGestion'),
      copropriete: sumDetail('copropriete'),
      autresCharges: sumDetail('autresCharges'),
    },
    interetsEmprunt: rows.reduce((s, r) => s + r.interetsEmprunt, 0),
    assuranceEmprunt: rows.reduce((s, r) => s + r.assuranceEmprunt, 0),
    amortissements: rows.reduce((s, r) => s + r.amortissements, 0),
    cashFlowReel: rows.reduce((s, r) => s + r.cashFlowReel, 0),
    resultatFiscal: rows.reduce((s, r) => s + r.resultatFiscal, 0),
    impotEstime: 0,
  };
  // Recalculate tax on consolidated result for IS
  totaux.impotEstime = regime === "IR"
    ? rows.reduce((s, r) => s + r.impotEstime, 0)
    : calculerImpotIS(Math.max(0, totaux.resultatFiscal));

  return { annee, regime, rows, totaux };
}

export function getAvailableYears(data: DonneesApp): number[] {
  const now = new Date().getFullYear();
  const years = new Set<number>();

  for (const p of data.properties) {
    // Use acquisition date (resolves statusDates > dateSaisie > createdAt)
    const acqYear = parseInt(getPropertyAcquisitionDate(p).slice(0, 4));
    if (acqYear > 2000 && acqYear <= now) years.add(acqYear);
    // Also add all statusDates years
    if (p.statusDates) {
      for (const d of Object.values(p.statusDates)) {
        if (d) { const y = parseInt(d.slice(0, 4)); if (y > 2000 && y <= now) years.add(y); }
      }
    }
  }
  for (const i of data.incomes) {
    const y = parseInt(i.dateDebut.slice(0, 4));
    if (y > 2000 && y <= now) years.add(y);
  }
  // Include years with rent tracking or charge payment data
  for (const r of (data.rentTracking ?? [])) {
    const y = parseInt(r.yearMonth.slice(0, 4));
    if (y > 2000 && y <= now) years.add(y);
  }
  for (const c of (data.chargePayments ?? [])) {
    const y = parseInt(c.periode.slice(0, 4));
    if (y > 2000 && y <= now) years.add(y);
  }

  if (years.size === 0) years.add(now);

  // Fill gaps between min and now (ascending order)
  const minYear = Math.min(...years);
  const result: number[] = [];
  for (let y = minYear; y <= now; y++) result.push(y);
  return result;
}
