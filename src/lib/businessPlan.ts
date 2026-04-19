import type { Bien, Lot, Depense } from "@/types";
import { annualiserMontant } from "./utils";
import { obtenirMontantCourant } from "./revisionsDepenses";
import type { Worksheet } from "exceljs";

interface BuildSheetParams {
  bien: Bien;
  lots: Lot[];
  chargesEntries: Array<{ label: string; montant: number }>;
  description: string;
  avantages: string;
  pointsFiscaux: string;
  // Achat
  prixAchat: number;
  montantTravaux: number;
  montantMobilier: number;
  fraisNotairePct: number;
  apportPct: number;
  // Pret
  dureeAnnees: number;
  tauxInteret: number;
  tauxAssurance: number;
  /**
   * Mode "capital tire" : apport fixe + travaux reduits pour refleter
   * l'etat a date. Le pret est alors calcule par formule (somme des couts
   * moins apport), ce qui donne automatiquement le capital effectivement
   * tire. Si omis, mode "capital total" (apport = %, pret = reste).
   */
  modeTire?: {
    apportEur: number;
    travauxTires: number;
  };
}

// Styles partages entre les onglets
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC9DAF8" } };
const HEADER_FONT = { bold: true, size: 12 };
const SUB_HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC9DAF8" } };
const SUB_HEADER_FONT = { bold: false, size: 11 };
const MAIN_TITLE_FONT = { bold: true, size: 16 };
const BOLD = { bold: true };
const EUR_FMT = '#,##0" €"';
const PCT_FMT = "0.00%";

function populateSheet(ws: Worksheet, p: BuildSheetParams): void {
  // Column widths (match template)
  ws.getColumn("A").width = 28;
  ws.getColumn("B").width = 18;
  ws.getColumn("C").width = 10;
  ws.getColumn("D").width = 24;
  ws.getColumn("E").width = 14;
  ws.getColumn("F").width = 20;

  const setHeader = (cellRef: string, value: string, opts?: { main?: boolean }) => {
    const c = ws.getCell(cellRef);
    c.value = value;
    c.fill = HEADER_FILL;
    c.font = opts?.main ? MAIN_TITLE_FONT : HEADER_FONT;
    c.alignment = { horizontal: "left", vertical: "middle" };
  };
  const setSubHeader = (cellRef: string, value: string) => {
    const c = ws.getCell(cellRef);
    c.value = value;
    c.fill = SUB_HEADER_FILL;
    c.font = SUB_HEADER_FONT;
  };

  // ─── Presentation du bien ─────────────────────────────────────
  setHeader("A1", "Presentation du bien", { main: true });
  ws.mergeCells("A1:F1");

  ws.getCell("A2").value = "Localisation";
  ws.getCell("A2").font = BOLD;
  const adresseParts: string[] = [];
  if (p.bien.adresse) adresseParts.push(p.bien.adresse);
  if (p.bien.ville && !adresseParts.some((x) => x.includes(p.bien.ville!))) adresseParts.push(p.bien.ville);
  ws.getCell("B2").value = adresseParts.join(", ");
  ws.mergeCells("B2:F2");

  ws.getCell("A4").value = "Avantage du bien";
  ws.getCell("A4").font = BOLD;
  ws.getCell("B4").value = p.avantages;
  ws.mergeCells("B4:F5");
  ws.getCell("B4").alignment = { wrapText: true, vertical: "top" };

  ws.getCell("A7").value = "Description du bien";
  ws.getCell("A7").font = BOLD;
  ws.getCell("B7").value = p.description;
  ws.mergeCells("B7:F9");
  ws.getCell("B7").alignment = { wrapText: true, vertical: "top" };

  // ─── Business plan (main title) ───────────────────────────────
  setHeader("A12", "Business plan", { main: true });
  ws.mergeCells("A12:F12");

  ws.getCell("A13").value = p.pointsFiscaux;
  ws.mergeCells("A13:F14");
  ws.getCell("A13").alignment = { wrapText: true, vertical: "top" };

  // ─── Achat (col A-B) + Loyer (col D-E) ───────────────────────
  setSubHeader("A15", "Achat");
  ws.mergeCells("A15:B15");
  setSubHeader("D15", "Loyer");
  ws.mergeCells("D15:F15");

  ws.getCell("A16").value = "Prix achat du bien";
  ws.getCell("B16").value = p.prixAchat;
  ws.getCell("B16").numFmt = EUR_FMT;

  // Travaux : reduit en mode "capital tire" (seule la portion deja financee
  // est comptee — le reste est encore dans l'enveloppe, non consomme).
  const travauxLabel = p.modeTire
    ? `Travaux financés à date (sur ${Math.round(p.montantTravaux).toLocaleString("fr-FR")} € d'enveloppe)`
    : "Travaux";
  ws.getCell("A17").value = travauxLabel;
  ws.getCell("B17").value = p.modeTire ? p.modeTire.travauxTires : p.montantTravaux;
  ws.getCell("B17").numFmt = EUR_FMT;

  ws.getCell("A18").value = "Ameublement";
  ws.getCell("B18").value = p.montantMobilier;
  ws.getCell("B18").numFmt = EUR_FMT;

  ws.getCell("A19").value = `Frais de notaire (${(p.fraisNotairePct * 100).toFixed(1)}%)`;
  ws.getCell("B19").value = { formula: `B16*${p.fraisNotairePct}` };
  ws.getCell("B19").numFmt = EUR_FMT;

  // Apport et pret :
  //  - Onglet "capital total" : apport = % du cout total, pret = reste
  //  - Onglet "capital tire"  : apport fixe (montant reel), pret = reste
  //    (avec les travaux reduits, le pret calcule = capital effectivement tire)
  if (p.modeTire) {
    ws.getCell("A20").value = "Apport de la SCI";
    ws.getCell("B20").value = p.modeTire.apportEur;
    ws.getCell("B20").numFmt = EUR_FMT;
    ws.getCell("B20").font = BOLD;

    ws.getCell("A21").value = "Montant du pret (capital tiré à date)";
    ws.getCell("B21").value = { formula: "B16+B17+B18+B19-B20" };
    ws.getCell("B21").numFmt = EUR_FMT;
    ws.getCell("B21").font = BOLD;
  } else {
    ws.getCell("A20").value = `Apport de la SCI (${(p.apportPct * 100).toFixed(0)}%)`;
    ws.getCell("B20").value = { formula: `(B16+B17+B18+B19)*${p.apportPct}` };
    ws.getCell("B20").numFmt = EUR_FMT;
    ws.getCell("B20").font = BOLD;

    ws.getCell("A21").value = "Montant du pret";
    ws.getCell("B21").value = { formula: "B16+B17+B18+B19-B20" };
    ws.getCell("B21").numFmt = EUR_FMT;
    ws.getCell("B21").font = BOLD;
  }

  // Loyer (col D-E)
  const loyerStartRow = 16;
  p.lots.forEach((lot, idx) => {
    const row = loyerStartRow + idx;
    ws.getCell(`D${row}`).value = lot.nom || `Lot ${idx + 1}`;
    ws.getCell(`E${row}`).value = lot.loyerMensuel ?? 0;
    ws.getCell(`E${row}`).numFmt = EUR_FMT;
  });
  const lastLotRow = loyerStartRow + Math.max(0, p.lots.length - 1);
  const totalMoisRow = lastLotRow + 1;
  const totalAnRow = totalMoisRow + 1;

  ws.getCell(`D${totalMoisRow}`).value = "Total loyer / mois";
  ws.getCell(`D${totalMoisRow}`).font = BOLD;
  ws.getCell(`E${totalMoisRow}`).value = {
    formula: p.lots.length > 0 ? `SUM(E${loyerStartRow}:E${lastLotRow})` : "0",
  };
  ws.getCell(`E${totalMoisRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalMoisRow}`).font = BOLD;

  ws.getCell(`D${totalAnRow}`).value = "Total loyer / an";
  ws.getCell(`D${totalAnRow}`).font = BOLD;
  ws.getCell(`E${totalAnRow}`).value = { formula: `E${totalMoisRow}*12` };
  ws.getCell(`E${totalAnRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalAnRow}`).font = BOLD;

  // ─── Charges annuelles ────────────────────────────────────────
  const chargesHeaderRow = Math.max(22, totalAnRow + 2);
  setSubHeader(`D${chargesHeaderRow}`, "Charges annuelles");
  ws.mergeCells(`D${chargesHeaderRow}:E${chargesHeaderRow}`);

  const chargesStartRow = chargesHeaderRow + 1;
  p.chargesEntries.forEach((c, idx) => {
    const row = chargesStartRow + idx;
    ws.getCell(`D${row}`).value = c.label;
    ws.getCell(`E${row}`).value = c.montant;
    ws.getCell(`E${row}`).numFmt = EUR_FMT;
  });
  const chargesLastRow = chargesStartRow + Math.max(0, p.chargesEntries.length - 1);
  const totalChargesRow = chargesLastRow + 1;
  ws.getCell(`D${totalChargesRow}`).value = "Total";
  ws.getCell(`D${totalChargesRow}`).font = BOLD;
  ws.getCell(`E${totalChargesRow}`).value = {
    formula: p.chargesEntries.length > 0 ? `SUM(E${chargesStartRow}:E${chargesLastRow})` : "0",
  };
  ws.getCell(`E${totalChargesRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalChargesRow}`).font = BOLD;

  // ─── Cout du Pret ─────────────────────────────────────────────
  const pretHeaderRow = 24;
  setSubHeader(`A${pretHeaderRow}`, "Cout du Pret (Estimation)");
  ws.mergeCells(`A${pretHeaderRow}:B${pretHeaderRow}`);

  ws.getCell("A25").value = "Annees";
  ws.getCell("B25").value = p.dureeAnnees;

  ws.getCell("A26").value = "Taux interet";
  ws.getCell("B26").value = p.tauxInteret;
  ws.getCell("B26").numFmt = PCT_FMT;

  ws.getCell("A27").value = "Taux assurance";
  ws.getCell("B27").value = p.tauxAssurance;
  ws.getCell("B27").numFmt = PCT_FMT;

  ws.getCell("A29").value = "Cout total assurance";
  ws.getCell("B29").value = { formula: "B21*B27*B25" };
  ws.getCell("B29").numFmt = EUR_FMT;

  ws.getCell("A30").value = "Cout total interet";
  ws.getCell("B30").value = { formula: "B32*12*B25-B21" };
  ws.getCell("B30").numFmt = EUR_FMT;

  ws.getCell("A32").value = "Total hors assurance / mois";
  ws.getCell("B32").value = { formula: "(B21*(B26/12))/(1 - POWER(1 + (B26/12),-B25*12))" };
  ws.getCell("B32").numFmt = EUR_FMT;

  ws.getCell("A33").value = "Total avec assurance / mois";
  ws.getCell("B33").value = { formula: "B32+B29/B25/12" };
  ws.getCell("B33").numFmt = EUR_FMT;
  ws.getCell("B33").font = BOLD;

  ws.getCell("A34").value = "Cout total du crédit";
  ws.getCell("B34").value = { formula: "B30+B29" };
  ws.getCell("B34").numFmt = EUR_FMT;

  // ─── Cashflow et Rendement ────────────────────────────────────
  const cfHeaderRow = Math.max(37, totalChargesRow + 2);
  setSubHeader(`A${cfHeaderRow}`, "Cashflow et Rendement");
  ws.mergeCells(`A${cfHeaderRow}:C${cfHeaderRow}`);

  const rdtRow = cfHeaderRow + 1;
  ws.getCell(`A${rdtRow}`).value = "Rendement brut";
  ws.getCell(`B${rdtRow}`).value = { formula: `E${totalAnRow}/B21` };
  ws.getCell(`B${rdtRow}`).numFmt = PCT_FMT;
  ws.getCell(`B${rdtRow}`).font = BOLD;

  const cfMoisRow = rdtRow + 1;
  ws.getCell(`A${cfMoisRow}`).value = "Cashflow / mois";
  ws.getCell(`B${cfMoisRow}`).value = { formula: `B${cfMoisRow + 1}/12` };
  ws.getCell(`B${cfMoisRow}`).numFmt = EUR_FMT;
  ws.getCell(`B${cfMoisRow}`).font = BOLD;

  const cfAnRow = cfMoisRow + 1;
  ws.getCell(`A${cfAnRow}`).value = "Cashflow / an";
  ws.getCell(`B${cfAnRow}`).value = { formula: `E${totalAnRow}-(B33*12+E${totalChargesRow})` };
  ws.getCell(`B${cfAnRow}`).numFmt = EUR_FMT;
  ws.getCell(`B${cfAnRow}`).font = BOLD;
}

/**
 * Export "Business Plan" au format xlsx — reprend la structure d'un template
 * bancaire classique. Genere 2 onglets si un capital tire different du capital
 * total est fourni :
 *   1. "Capital total"  : scenario pret complet (demande de pret)
 *   2. "Capital tire"   : scenario capital effectivement tire a date
 */
export async function exporterBusinessPlan(params: {
  bien: Bien;
  lots: Lot[];
  depenses: Depense[];
  description?: string;
  avantages?: string;
  pointsFiscaux?: string;
  dureeAnnees: number;
  tauxInteret: number;
  tauxAssurance: number;
  apportPct: number;
  /** Capital effectivement tire a date. Si defini et different du cout total,
   *  un 2eme onglet "Capital tire" est genere. */
  montantEmprunteEffectif?: number;
  /** Capital total du pret (pour detecter le delta). */
  montantEmprunteTotal?: number;
}): Promise<void> {
  const {
    bien, lots, depenses,
    description, avantages, pointsFiscaux,
    dureeAnnees, tauxInteret, tauxAssurance, apportPct,
    montantEmprunteEffectif, montantEmprunteTotal,
  } = params;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haussmann";
  wb.created = new Date();

  // ─── Charges agregees par categorie (commun aux 2 onglets) ────────────────
  const EXCLUDED = new Set(["credit", "vacance", "frais_notaire", "travaux", "ameublement"]);
  const byCat = new Map<string, number>();
  for (const dep of depenses) {
    if (EXCLUDED.has(dep.categorie)) continue;
    const annuel = annualiserMontant(obtenirMontantCourant(dep), dep.frequence);
    if (annuel <= 0) continue;
    byCat.set(dep.categorie, (byCat.get(dep.categorie) ?? 0) + annuel);
  }
  const CAT_LABELS: Record<string, string> = {
    taxe_fonciere: "Taxe fonciere",
    copropriete: "Charges",
    assurance_pno: "Assurance PNO",
    gestion_locative: "Gestion Locative",
    charges_locatives: "Charges locatives",
    reparations: "Réparations / entretien",
    gli: "GLI",
    autre: "Autre",
  };
  const chargesEntries: Array<{ label: string; montant: number }> = [];
  for (const [cat, montant] of byCat) {
    chargesEntries.push({ label: CAT_LABELS[cat] ?? cat, montant: Math.round(montant) });
  }
  if (!chargesEntries.some((c) => c.label.toLowerCase().includes("imprevu") || c.label.toLowerCase().includes("imprévu"))) {
    chargesEntries.push({ label: "Imprévu", montant: 1000 });
  }

  const fraisNotairePct = bien.prixAchat > 0 ? (bien.fraisNotaire / bien.prixAchat) : 0.08;

  const travauxTotal = bien.montantTravaux || 0;
  const commonParams: Omit<BuildSheetParams, "modeTire"> = {
    bien, lots, chargesEntries,
    description: description ?? bien.notes ?? "",
    avantages: avantages ?? "",
    pointsFiscaux: pointsFiscaux ?? "Le financement se fera via une SC à l'IS dont les associés se partagent les parts.",
    prixAchat: bien.prixAchat,
    montantTravaux: travauxTotal,
    montantMobilier: bien.montantMobilier || 0,
    fraisNotairePct,
    apportPct,
    dureeAnnees, tauxInteret, tauxAssurance,
  };

  // ─── Onglet 1 : capital total (prêt complet) ──────────────────────────────
  const wsTotal = wb.addWorksheet("Capital total");
  populateSheet(wsTotal, commonParams);

  // ─── Onglet 2 : capital tire (si delta) ───────────────────────────────────
  // Coherence : si une partie du credit n'est pas encore tiree, c'est parce
  // que l'enveloppe travaux n'est pas pleinement consommee. On reduit donc
  // les travaux dans ce scenario pour que apport + pret tire = cout du projet
  // a date (sans les travaux non tires).
  const hasCapitalDelta = montantEmprunteEffectif != null
    && montantEmprunteTotal != null
    && Math.round(montantEmprunteEffectif) !== Math.round(montantEmprunteTotal);
  if (hasCapitalDelta) {
    const apportReel = bien.apport ?? Math.max(0, (bien.prixAchat + (bien.fraisNotaire ?? 0) + travauxTotal + (bien.montantMobilier ?? 0)) - montantEmprunteTotal);
    const travauxNonTires = Math.max(0, montantEmprunteTotal - montantEmprunteEffectif);
    const travauxTires = Math.max(0, travauxTotal - travauxNonTires);
    const wsTire = wb.addWorksheet("Capital tiré");
    populateSheet(wsTire, {
      ...commonParams,
      modeTire: {
        apportEur: Math.round(apportReel),
        travauxTires: Math.round(travauxTires),
      },
    });
  }

  // ─── Generate + download ─────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (bien.nom || "bien")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `business-plan-${safeName}-${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
