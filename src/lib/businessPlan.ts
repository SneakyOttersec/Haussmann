import type { Bien, Lot, Depense } from "@/types";
import { annualiserMontant } from "./utils";
import { obtenirMontantCourant } from "./revisionsDepenses";

/**
 * Export "Business Plan" au format xlsx — reprend la structure d'un template
 * bancaire classique : presentation bien, achat, loyer, charges, pret, CF & rdt.
 * Les formules Excel sont preservees pour que le banquier puisse ajuster les
 * hypotheses (apport 10%, frais notaire 8%, etc.) sans recalculer a la main.
 */
export async function exporterBusinessPlan(params: {
  bien: Bien;
  lots: Lot[];
  depenses: Depense[];
  description?: string;
  avantages?: string;
  pointsFiscaux?: string;
  // Parametres du pret (affiches dans la partie "Cout du Pret")
  dureeAnnees: number;
  tauxInteret: number;
  tauxAssurance: number;
  // Repartition apport / pret
  apportPct: number; // 0.10 = 10% du cout total
}): Promise<void> {
  const {
    bien, lots, depenses,
    description, avantages, pointsFiscaux,
    dureeAnnees, tauxInteret, tauxAssurance, apportPct,
  } = params;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haussmann";
  wb.created = new Date();
  const ws = wb.addWorksheet("Business Plan");

  // Column widths (match template)
  ws.getColumn("A").width = 28;
  ws.getColumn("B").width = 18;
  ws.getColumn("C").width = 10;
  ws.getColumn("D").width = 24;
  ws.getColumn("E").width = 14;
  ws.getColumn("F").width = 20;

  // Styles
  const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC9DAF8" } };
  const HEADER_FONT = { bold: true, size: 12 };
  const SUB_HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC9DAF8" } };
  const SUB_HEADER_FONT = { bold: false, size: 11 };
  const MAIN_TITLE_FONT = { bold: true, size: 16 };
  const BOLD = { bold: true };
  const EUR_FMT = '#,##0" €"';
  const PCT_FMT = "0.00%";

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

  // ─── Row 1: Presentation du bien ─────────────────────────────
  setHeader("A1", "Presentation du bien", { main: true });
  ws.mergeCells("A1:F1");

  // Row 2: Localisation
  ws.getCell("A2").value = "Localisation";
  ws.getCell("A2").font = BOLD;
  const adresseParts: string[] = [];
  if (bien.adresse) adresseParts.push(bien.adresse);
  if (bien.ville && !adresseParts.some((p) => p.includes(bien.ville!))) adresseParts.push(bien.ville);
  ws.getCell("B2").value = adresseParts.join(", ");
  ws.mergeCells("B2:F2");

  // Row 4-5: Avantage du bien
  ws.getCell("A4").value = "Avantage du bien";
  ws.getCell("A4").font = BOLD;
  ws.getCell("B4").value = avantages ?? "";
  ws.mergeCells("B4:F5");
  ws.getCell("B4").alignment = { wrapText: true, vertical: "top" };

  // Row 7-9: Description du bien
  ws.getCell("A7").value = "Description du bien";
  ws.getCell("A7").font = BOLD;
  ws.getCell("B7").value = description ?? bien.notes ?? "";
  ws.mergeCells("B7:F9");
  ws.getCell("B7").alignment = { wrapText: true, vertical: "top" };

  // ─── Row 12: Business plan (main title) ─────────────────────
  setHeader("A12", "Business plan", { main: true });
  ws.mergeCells("A12:F12");

  // Row 13-14: intro text
  ws.getCell("A13").value = pointsFiscaux
    ?? "Le financement se fera via une SC à l'IS dont les associés se partagent les parts.";
  ws.mergeCells("A13:F14");
  ws.getCell("A13").alignment = { wrapText: true, vertical: "top" };

  // ─── Row 15: Achat (left) + Loyer (right) sub-headers ────────
  setSubHeader("A15", "Achat");
  ws.mergeCells("A15:B15");
  setSubHeader("D15", "Loyer");
  ws.mergeCells("D15:F15");

  // Column Achat (A-B)
  ws.getCell("A16").value = "Prix achat du bien";
  ws.getCell("B16").value = bien.prixAchat;
  ws.getCell("B16").numFmt = EUR_FMT;

  ws.getCell("A17").value = "Travaux";
  ws.getCell("B17").value = bien.montantTravaux || 0;
  ws.getCell("B17").numFmt = EUR_FMT;

  ws.getCell("A18").value = "Ameublement";
  ws.getCell("B18").value = bien.montantMobilier || 0;
  ws.getCell("B18").numFmt = EUR_FMT;

  // Frais de notaire — formule avec le taux implicite (B16 * pct)
  const fraisNotairePct = bien.prixAchat > 0 ? (bien.fraisNotaire / bien.prixAchat) : 0.08;
  ws.getCell("A19").value = `Frais de notaire (${(fraisNotairePct * 100).toFixed(1)}%)`;
  ws.getCell("B19").value = { formula: `B16*${fraisNotairePct}` };
  ws.getCell("B19").numFmt = EUR_FMT;

  // Apport SCI (% du sous-total acquisition)
  ws.getCell("A20").value = `Apport de la SCI (${(apportPct * 100).toFixed(0)}%)`;
  ws.getCell("B20").value = { formula: `(B16+B17+B18+B19)*${apportPct}` };
  ws.getCell("B20").numFmt = EUR_FMT;
  ws.getCell("B20").font = BOLD;

  // Montant du pret
  ws.getCell("A21").value = "Montant du pret";
  ws.getCell("B21").value = { formula: "B16+B17+B18+B19-B20" };
  ws.getCell("B21").numFmt = EUR_FMT;
  ws.getCell("B21").font = BOLD;

  // Column Loyer (D-E)
  const loyerStartRow = 16;
  lots.forEach((lot, idx) => {
    const row = loyerStartRow + idx;
    ws.getCell(`D${row}`).value = lot.nom || `Lot ${idx + 1}`;
    ws.getCell(`E${row}`).value = lot.loyerMensuel ?? 0;
    ws.getCell(`E${row}`).numFmt = EUR_FMT;
  });
  const lastLotRow = loyerStartRow + Math.max(0, lots.length - 1);
  const totalMoisRow = lastLotRow + 1;
  const totalAnRow = totalMoisRow + 1;

  ws.getCell(`D${totalMoisRow}`).value = "Total loyer / mois";
  ws.getCell(`D${totalMoisRow}`).font = BOLD;
  ws.getCell(`E${totalMoisRow}`).value = {
    formula: lots.length > 0 ? `SUM(E${loyerStartRow}:E${lastLotRow})` : "0"
  };
  ws.getCell(`E${totalMoisRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalMoisRow}`).font = BOLD;

  ws.getCell(`D${totalAnRow}`).value = "Total loyer / an";
  ws.getCell(`D${totalAnRow}`).font = BOLD;
  ws.getCell(`E${totalAnRow}`).value = { formula: `E${totalMoisRow}*12` };
  ws.getCell(`E${totalAnRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalAnRow}`).font = BOLD;

  // ─── Charges annuelles (right column, row 22+) ──────────────
  const chargesHeaderRow = Math.max(22, totalAnRow + 2);
  setSubHeader(`D${chargesHeaderRow}`, "Charges annuelles");
  ws.mergeCells(`D${chargesHeaderRow}:E${chargesHeaderRow}`);

  // Build charges from depenses (excluding credit, notaire, travaux, ameublement, vacance)
  const EXCLUDED = new Set(["credit", "vacance", "frais_notaire", "travaux", "ameublement"]);
  const chargesEntries: Array<{ label: string; montant: number }> = [];
  // Grouper par categorie en annualisant
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
  for (const [cat, montant] of byCat) {
    chargesEntries.push({ label: CAT_LABELS[cat] ?? cat, montant: Math.round(montant) });
  }
  // Ajoute un "Imprévu" si non present
  if (!chargesEntries.some((c) => c.label.toLowerCase().includes("imprevu"))) {
    chargesEntries.push({ label: "Imprévu", montant: 1000 });
  }

  const chargesStartRow = chargesHeaderRow + 1;
  chargesEntries.forEach((c, idx) => {
    const row = chargesStartRow + idx;
    ws.getCell(`D${row}`).value = c.label;
    ws.getCell(`E${row}`).value = c.montant;
    ws.getCell(`E${row}`).numFmt = EUR_FMT;
  });
  const chargesLastRow = chargesStartRow + Math.max(0, chargesEntries.length - 1);
  const totalChargesRow = chargesLastRow + 1;
  ws.getCell(`D${totalChargesRow}`).value = "Total";
  ws.getCell(`D${totalChargesRow}`).font = BOLD;
  ws.getCell(`E${totalChargesRow}`).value = {
    formula: chargesEntries.length > 0 ? `SUM(E${chargesStartRow}:E${chargesLastRow})` : "0",
  };
  ws.getCell(`E${totalChargesRow}`).numFmt = EUR_FMT;
  ws.getCell(`E${totalChargesRow}`).font = BOLD;

  // ─── Cout du Pret (left column, row 24+) ────────────────────
  const pretHeaderRow = 24;
  setSubHeader(`A${pretHeaderRow}`, "Cout du Pret (Estimation)");
  ws.mergeCells(`A${pretHeaderRow}:B${pretHeaderRow}`);

  ws.getCell("A25").value = "Annees";
  ws.getCell("B25").value = dureeAnnees;

  ws.getCell("A26").value = "Taux interet";
  ws.getCell("B26").value = tauxInteret;
  ws.getCell("B26").numFmt = PCT_FMT;

  ws.getCell("A27").value = "Taux assurance";
  ws.getCell("B27").value = tauxAssurance;
  ws.getCell("B27").numFmt = PCT_FMT;

  ws.getCell("A29").value = "Cout total assurance";
  ws.getCell("B29").value = { formula: "B21*B27*B25" };
  ws.getCell("B29").numFmt = EUR_FMT;

  ws.getCell("A30").value = "Cout total interet";
  ws.getCell("B30").value = { formula: "B32*12*B25-B21" };
  ws.getCell("B30").numFmt = EUR_FMT;

  // Mensualite annuity formula (hors assurance)
  // M = P * (t / (1 - (1+t)^(-n))) with t = rate/12, n = years*12
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

  // ─── Cashflow et Rendement (row 37+) ────────────────────────
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

  // ─── Generate + download ────────────────────────────────────
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
