import type { AppData, CalculatorInputs, LotLoyer, LotMobilier } from "@/types";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { annualiserMontant, mensualiserMontant } from "@/lib/utils";

/**
 * Build CalculatorInputs from an existing property in AppData.
 * Symmetric of simulationToBien: reads property + linked lots, incomes,
 * expenses and loan, reconstructing a simulation that matches.
 *
 * Returns null if property not found.
 */
export function bienToSimulation(data: AppData, propertyId: string): CalculatorInputs | null {
  const property = data.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  const propertyLots = (data.lots ?? []).filter((l) => l.propertyId === propertyId);
  const propertyIncomes = data.incomes.filter((i) => i.propertyId === propertyId);
  const propertyExpenses = data.expenses.filter(
    (e) => e.propertyId === propertyId && e.categorie !== "credit",
  );
  const loan = data.loans.find((l) => l.propertyId === propertyId);

  // Lots: prefer explicit lots; fallback on loyer incomes
  let lots: LotLoyer[];
  if (propertyLots.length > 0) {
    lots = propertyLots.map((l) => ({
      id: l.id,
      nom: l.nom,
      loyerMensuel: l.loyerMensuel,
    }));
  } else {
    const loyerIncomes = propertyIncomes.filter((i) => i.categorie === "loyer");
    lots = loyerIncomes.length > 0
      ? loyerIncomes.map((i) => ({
          id: i.id,
          nom: i.label || "Lot",
          loyerMensuel: mensualiserMontant(i.montant, i.frequence),
        }))
      : [{ id: "1", nom: "Lot 1", loyerMensuel: 0 }];
  }

  const loyerMensuelTotal = lots.reduce((s, l) => s + l.loyerMensuel, 0);

  // Other recurring revenues (parking, charges recuperees, autre)
  const autresRevenusAnnuels = propertyIncomes
    .filter((i) => i.categorie !== "loyer" && i.frequence !== "ponctuel")
    .reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);

  // Charges mapping from expense categories
  const sumAnnualByCategory = (cat: string) =>
    propertyExpenses
      .filter((e) => e.categorie === cat && e.frequence !== "ponctuel")
      .reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);

  const chargesCopro = sumAnnualByCategory("copropriete");
  const taxeFonciere = sumAnnualByCategory("taxe_fonciere");
  const assurancePNO = sumAnnualByCategory("assurance_pno");
  const entretien = sumAnnualByCategory("reparations");
  const chargesLocatives = sumAnnualByCategory("charges_locatives");
  const gestionLocativeEur = sumAnnualByCategory("gestion_locative");
  const autresRaw = sumAnnualByCategory("autre");

  // gestion_locative stored in € but calc expects % of loyer net
  const loyerNetAnnuel = loyerMensuelTotal * 12 * (1 - DEFAULT_CALCULATOR_INPUTS.tauxVacance);
  const gestionLocativePct =
    loyerNetAnnuel > 0 && gestionLocativeEur > 0
      ? gestionLocativeEur / loyerNetAnnuel
      : DEFAULT_CALCULATOR_INPUTS.gestionLocativePct;

  const autresChargesAnnuelles = autresRaw + chargesLocatives;

  // Mobilier: create a lot if amount > 0
  const lotsMobilier: LotMobilier[] =
    (property.montantMobilier ?? 0) > 0
      ? [{ id: "mob-1", nom: "Mobilier", montant: property.montantMobilier ?? 0 }]
      : [];
  const montantMobilierTotal = lotsMobilier.reduce((s, l) => s + l.montant, 0);

  return {
    ...DEFAULT_CALCULATOR_INPUTS,
    // Meta
    nomSimulation: property.nom,
    adresse: property.adresse,

    // Acquisition
    prixAchat: property.prixAchat,
    fraisNotairePct: property.prixAchat > 0
      ? property.fraisNotaire / property.prixAchat
      : DEFAULT_CALCULATOR_INPUTS.fraisNotairePct,
    fraisAgence: property.fraisAgence ?? 0,
    fraisDossier: property.fraisDossier ?? 0,
    fraisCourtage: property.fraisCourtage ?? 0,
    surfaceM2: property.surfaceM2 ?? 0,
    montantTravaux: property.montantTravaux,
    montantMobilier: property.montantMobilier ?? 0,
    montantMobilierTotal,
    lotsMobilier,

    // Notes
    pointsNotables: property.notes ?? "",

    // Revenus
    lots,
    loyerMensuel: loyerMensuelTotal,
    autresRevenusAnnuels,

    // Charges
    chargesCopro,
    taxeFonciere,
    assurancePNO,
    entretien,
    gestionLocativePct,
    autresChargesAnnuelles,

    // Financement
    ...(loan
      ? {
          montantEmprunte: loan.montantEmprunte,
          tauxCredit: loan.tauxAnnuel,
          dureeCredit: loan.dureeAnnees,
          typePret: loan.type,
          assurancePretMode: "eur" as const,
          assurancePretAnnuelle: loan.assuranceAnnuelle,
          apportPersonnel: Math.max(
            0,
            property.prixAchat + property.fraisNotaire + (property.fraisAgence ?? 0) +
              (property.fraisDossier ?? 0) + (property.fraisCourtage ?? 0) +
              property.montantTravaux - loan.montantEmprunte,
          ),
        }
      : {}),

    // Fiscalite
    regimeFiscal: data.settings.regimeFiscal,
  };
}
