import type { DonneesApp, EntreesCalculateur, LotLoyer, LotMobilier } from "@/types";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { annualiserMontant, mensualiserMontant } from "@/lib/utils";

/**
 * Build EntreesCalculateur from an existing bien in DonneesApp.
 * Symmetric of simulationToBien: reads bien + linked lots, revenus,
 * depenses and pret, reconstructing a simulation that matches.
 *
 * Returns null if bien not found.
 */
export function bienToSimulation(data: DonneesApp, bienId: string): EntreesCalculateur | null {
  const bien = data.biens.find((p) => p.id === bienId);
  if (!bien) return null;

  const propertyLots = (data.lots ?? []).filter((l) => l.bienId === bienId);
  const propertyIncomes = data.revenus.filter((i) => i.bienId === bienId);
  const propertyExpenses = data.depenses.filter(
    (e) => e.bienId === bienId && e.categorie !== "credit",
  );
  const pret = data.prets.find((l) => l.bienId === bienId);

  // Lots: prefer explicit lots; fallback on loyer revenus
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

  // Charges mapping from depense categories
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
  const vacanceBien = bien.tauxVacanceGlobal;
  const inferredVacance = loyerMensuelTotal > 0
    ? (vacanceBien ?? Math.max(0, Math.min(0.95, 1 - Math.min(1, propertyIncomes
      .filter((i) => i.categorie === "loyer" && i.frequence !== "ponctuel")
      .reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0) / (loyerMensuelTotal * 12)))))
    : DEFAULT_CALCULATOR_INPUTS.tauxVacance;
  const loyerNetAnnuel = loyerMensuelTotal * 12 * (1 - inferredVacance);
  const gestionLocativePct =
    loyerNetAnnuel > 0 && gestionLocativeEur > 0
      ? gestionLocativeEur / loyerNetAnnuel
      : DEFAULT_CALCULATOR_INPUTS.gestionLocativePct;

  const autresChargesAnnuelles = autresRaw + chargesLocatives;

  // Mobilier: create a lot if amount > 0
  const lotsMobilier: LotMobilier[] =
    (bien.montantMobilier ?? 0) > 0
      ? [{ id: "mob-1", nom: "Mobilier", montant: bien.montantMobilier ?? 0 }]
      : [];
  const montantMobilierTotal = lotsMobilier.reduce((s, l) => s + l.montant, 0);

  return {
    ...DEFAULT_CALCULATOR_INPUTS,
    // Meta
    nomSimulation: bien.nom,
    adresse: bien.adresse,
    type: bien.type,
    dateSaisie: bien.dateSaisie,

    // Acquisition
    prixAchat: bien.prixAchat,
    fraisNotairePct: bien.prixAchat > 0
      ? bien.fraisNotaire / bien.prixAchat
      : DEFAULT_CALCULATOR_INPUTS.fraisNotairePct,
    fraisAgence: bien.fraisAgence ?? 0,
    fraisDossier: bien.fraisDossier ?? 0,
    fraisCourtage: bien.fraisCourtage ?? 0,
    fraisGarantie: bien.allocationCredit?.garantie ?? 0,
    surfaceM2: bien.surfaceM2 ?? 0,
    montantTravaux: bien.montantTravaux,
    montantMobilier: bien.montantMobilier ?? 0,
    montantMobilierTotal,
    lotsMobilier,

    // Notes
    pointsNotables: bien.notes ?? "",

    // Revenus
    lots,
    loyerMensuel: loyerMensuelTotal,
    autresRevenusAnnuels,
    tauxVacance: inferredVacance,

    // Charges
    chargesCopro,
    taxeFonciere,
    assurancePNO,
    entretien,
    gestionLocativePct,
    autresChargesAnnuelles,

    // Financement
    ...(pret
      ? {
          montantEmprunte: pret.montantEmprunte,
          tauxCredit: pret.tauxAnnuel,
          dureeCredit: pret.dureeAnnees,
          typePret: pret.type,
          assurancePretMode: "eur" as const,
          assurancePretAnnuelle: pret.assuranceAnnuelle,
          differePretMois: pret.differeMois ?? 0,
          differePretInclus: pret.differeInclus ?? true,
          apportPersonnel: bien.apport ?? Math.max(
            0,
            bien.prixAchat + bien.fraisNotaire + (bien.fraisAgence ?? 0) +
              (bien.fraisDossier ?? 0) + (bien.fraisCourtage ?? 0) +
              bien.montantTravaux + (bien.montantMobilier ?? 0) + (bien.allocationCredit?.garantie ?? 0) - pret.montantEmprunte,
          ),
        }
      : {}),

    // Fiscalite
    regimeFiscal: data.settings.regimeFiscal,
  };
}
