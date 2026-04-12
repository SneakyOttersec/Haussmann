import type { AppData, CalculatorInputs, Property, Income, Expense, LoanDetails, Lot } from "@/types";
import { generateId, now } from "@/lib/utils";
import { calculerMensualite } from "@/lib/calculations/loan";

/**
 * Creates a Property + Incomes + Expenses + Loan from a CalculatorInputs simulation.
 * Returns the new property ID.
 */
export function simulationToBien(
  inputs: CalculatorInputs,
  setData: (updater: (prev: AppData) => AppData) => void,
  simulationId?: string,
): string {
  const propertyId = generateId();
  const timestamp = now();
  const today = new Date().toISOString().slice(0, 10);

  const fraisNotaire = Math.round(inputs.prixAchat * inputs.fraisNotairePct);
  const fraisAgence = inputs.fraisAgence || 0;
  const fraisDossier = inputs.fraisDossier || 0;
  const fraisCourtage = inputs.fraisCourtage || 0;
  const autreAlloc = fraisDossier + fraisCourtage;

  const property: Property = {
    id: propertyId,
    nom: inputs.nomSimulation || "Nouveau bien",
    adresse: inputs.adresse || "",
    type: "appartement",
    prixAchat: inputs.prixAchat,
    dateSaisie: today,
    fraisNotaire,
    fraisAgence,
    fraisDossier,
    fraisCourtage,
    montantTravaux: inputs.montantTravaux,
    montantMobilier: inputs.montantMobilierTotal || 0,
    surfaceM2: inputs.surfaceM2 || undefined,
    simulationId,
    // A property born from a simulation is still being prospected — not yet
    // owned. The user moves the timeline forward as the deal progresses
    // (offre → compromis → acte). Until then, finances/loyers/charges treat
    // it as theoretical projections (see isPostActe / pre-acte gating).
    statut: "prospection",
    statusDates: { prospection: today },
    allocationCredit: inputs.montantEmprunte > 0 ? (() => {
      // L'apport couvre une partie du prix du bien — le credit finance le reste
      const autresCouts = inputs.montantTravaux + fraisNotaire + fraisAgence + autreAlloc;
      const bienFinance = Math.max(0, inputs.montantEmprunte - autresCouts);
      return {
        bien: bienFinance,
        travaux: inputs.montantTravaux,
        notaire: fraisNotaire,
        agence: fraisAgence,
        autre: autreAlloc,
      };
    })() : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Lots + Incomes: one per lot from simulation
  const simLots = (inputs.lots && inputs.lots.length > 0 ? inputs.lots : [{ id: "1", nom: "Lot 1", loyerMensuel: inputs.loyerMensuel }])
    .filter((lot) => lot.loyerMensuel > 0);

  const lots: Lot[] = simLots.map((lot) => ({
    id: generateId(),
    propertyId,
    nom: lot.nom || "Lot",
    loyerMensuel: lot.loyerMensuel,
    statut: "vacant" as const,
  }));

  const incomes: Income[] = simLots.map((lot) => ({
    id: generateId(),
    propertyId,
    categorie: "loyer" as const,
    label: lot.nom || "Loyer",
    montant: lot.loyerMensuel,
    frequence: "mensuel" as const,
    dateDebut: new Date().toISOString().slice(0, 10),
    notes: `Lot: ${lot.nom || "Lot"}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  // Expenses: one per charge category
  const chargeEntries: { categorie: Expense["categorie"]; label: string; montant: number }[] = [
    { categorie: "copropriete", label: "Copropriete", montant: inputs.chargesCopro },
    { categorie: "taxe_fonciere", label: "Taxe fonciere", montant: inputs.taxeFonciere },
    { categorie: "assurance_pno", label: "Assurance PNO", montant: inputs.assurancePNO },
    { categorie: "gestion_locative", label: "Gestion locative", montant: Math.round(inputs.loyerMensuel * 12 * (1 - inputs.tauxVacance) * inputs.gestionLocativePct) },
    { categorie: "autre", label: "Comptabilite", montant: inputs.comptabilite },
    { categorie: "autre", label: "CFE / CRL", montant: inputs.cfeCrl },
    { categorie: "reparations", label: "Entretien", montant: inputs.entretien },
    { categorie: "autre", label: "GLI", montant: inputs.gli },
  ];

  if (inputs.autresChargesAnnuelles > 0) {
    chargeEntries.push({ categorie: "autre", label: "Autres charges", montant: inputs.autresChargesAnnuelles });
  }

  const expenses: Expense[] = chargeEntries
    .filter((c) => c.montant > 0)
    .map((c) => ({
      id: generateId(),
      propertyId,
      categorie: c.categorie,
      label: c.label,
      montant: c.montant,
      frequence: "annuel" as const,
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

  // Credit expense (mensuel)
  if (inputs.montantEmprunte > 0) {
    const mensualite = calculerMensualite(inputs.montantEmprunte, inputs.tauxCredit, inputs.dureeCredit, inputs.typePret);
    const assuranceMensuelle = inputs.assurancePretMode === "pct"
      ? (inputs.montantEmprunte * inputs.assurancePretPct) / 12
      : inputs.assurancePretAnnuelle / 12;

    expenses.push({
      id: generateId(),
      propertyId,
      categorie: "credit",
      label: "Mensualite credit",
      montant: Math.round((mensualite + assuranceMensuelle) * 100) / 100,
      frequence: "mensuel",
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  // Loan — propagate defer config from the simulator
  const loans: LoanDetails[] = inputs.montantEmprunte > 0
    ? [{
        id: generateId(),
        propertyId,
        type: inputs.typePret,
        montantEmprunte: inputs.montantEmprunte,
        tauxAnnuel: inputs.tauxCredit,
        dureeAnnees: inputs.dureeCredit,
        dateDebut: today,
        assuranceAnnuelle: inputs.assurancePretMode === "pct"
          ? inputs.montantEmprunte * inputs.assurancePretPct
          : inputs.assurancePretAnnuelle,
        differeMois: inputs.differePretMois || undefined,
        differeType: inputs.differePretMois ? "partiel" : undefined,
        differeInclus: inputs.differePretMois ? (inputs.differePretInclus ?? true) : undefined,
      }]
    : [];

  setData((prev) => ({
    ...prev,
    properties: [...prev.properties, property],
    incomes: [...prev.incomes, ...incomes],
    expenses: [...prev.expenses, ...expenses],
    loans: [...prev.loans, ...loans],
    lots: [...(prev.lots ?? []), ...lots],
  }));

  return propertyId;
}
