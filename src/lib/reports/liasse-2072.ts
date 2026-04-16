import type jsPDF from "jspdf";
import type { DonneesApp } from "@/types";
import { TYPE_BIEN_LABELS } from "@/types";
import { computeBilanFiscal } from "@/lib/calculs/bilanFiscal";
import { getPropertyAcquisitionDate } from "@/lib/utils";

// ── Layout constants ──

const M = 18;      // margin
const PW = 210;    // page width (A4)
const PH = 297;    // page height

const C = {
  primary: [204, 42, 65] as [number, number, number],
  teal: [86, 124, 119] as [number, number, number],
  dark: [34, 39, 42] as [number, number, number],
  muted: [102, 102, 102] as [number, number, number],
  border: [180, 180, 180] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [180, 30, 30] as [number, number, number],
};

function eur(v: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
}

function dashed(doc: jsPDF, y: number, x1 = M, x2 = PW - M) {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.teal);
  doc.text(title.toUpperCase(), M, y);
  dashed(doc, y + 1.5);
  return y + 7;
}

function row(doc: jsPDF, y: number, label: string, value: string, opts?: { bold?: boolean; color?: [number, number, number]; indent?: number }): number {
  const x = M + (opts?.indent ?? 0);
  doc.setFontSize(8);
  doc.setFont("courier", opts?.bold ? "bold" : "normal");
  doc.setTextColor(...(opts?.color ?? (opts?.bold ? C.dark : C.muted)));
  doc.text(label, x + 2, y);
  doc.text(value, PW - M - 2, y, { align: "right" });
  doc.setFont("courier", "normal");
  return y + 4.5;
}

function tableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; w: number; align?: "left" | "right" }[]): number {
  doc.setFontSize(6.5);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.teal);
  for (const col of cols) {
    if (col.align === "right") {
      doc.text(col.label, col.x + col.w - 2, y, { align: "right" });
    } else {
      doc.text(col.label, col.x + 2, y);
    }
  }
  dashed(doc, y + 1.5);
  return y + 5;
}

function tableRow(doc: jsPDF, y: number, cols: { value: string; x: number; w: number; align?: "left" | "right"; bold?: boolean }[]): number {
  doc.setFontSize(7.5);
  for (const col of cols) {
    doc.setFont("courier", col.bold ? "bold" : "normal");
    doc.setTextColor(...(col.bold ? C.dark : C.muted));
    if (col.align === "right") {
      doc.text(col.value, col.x + col.w - 2, y, { align: "right" });
    } else {
      doc.text(col.value, col.x + 2, y);
    }
  }
  return y + 4.5;
}

function pageHeader(doc: jsPDF, nomSCI: string, annee: number) {
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 3, "F");
  doc.setFontSize(7);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.primary);
  doc.text(`DECLARATION 2072-S — ${nomSCI}`, M, 10);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`Exercice ${annee}`, PW - M, 10, { align: "right" });
  dashed(doc, 14);
}

function pageFooter(doc: jsPDF, page: number, total: number, nomSCI: string) {
  dashed(doc, PH - 15);
  doc.setFontSize(6);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`${nomSCI} — Liasse fiscale 2072-S`, M, PH - 10);
  doc.text(`${page}/${total}`, PW - M, PH - 10, { align: "right" });
}

// ── Missing data detection ──

function detectMissingData(data: DonneesApp, bilan: ReturnType<typeof computeBilanFiscal>): string[] {
  const missing: string[] = [];
  if (!data.settings.siren) missing.push("SIREN");
  if (!data.settings.adresseSiege) missing.push("Adresse du siege");
  if (bilan.totaux.revenusLocatifs === 0) missing.push("Revenus locatifs");
  if (data.biens.filter(p => !p.deletedAt).length === 0) missing.push("Aucun bien");
  if ((data.settings.associes ?? []).length === 0) missing.push("Associes");
  const hasLoan = data.prets.length > 0;
  if (hasLoan && bilan.totaux.interetsEmprunt === 0) missing.push("Interets d'emprunt");
  return missing;
}

function applyWatermark(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 0.08 }));
    doc.setFontSize(42);
    doc.setFont("courier", "bold");
    doc.setTextColor(180, 30, 30);
    // Rotate text diagonally across the page
    const cx = PW / 2;
    const cy = PH / 2;
    const angle = -35;
    doc.text("SIMULATION ONLY", cx, cy - 10, { align: "center", angle });
    doc.text("MISSING DATA", cx, cy + 12, { align: "center", angle });
    doc.restoreGraphicsState();
  }
}

// ── Main generator ──

export async function generateLiasse2072(data: DonneesApp, annee: number): Promise<void> {
  const { settings } = data;
  const bilan = computeBilanFiscal(data, annee);
  const biens = data.biens.filter(p => !p.deletedAt);
  const missingData = detectMissingData(data, bilan);

  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  doc.setFont("courier");

  const totalPages = 3;

  // ═══════════════════════════════════════════
  // PAGE 1 — Identification + Immeubles
  // ═══════════════════════════════════════════

  pageHeader(doc, settings.nomSCI, annee);
  let y = 22;

  // Cadre I — Identification
  y = sectionTitle(doc, y, "Cadre I — Identification de la societe");
  y = row(doc, y, "Denomination", settings.nomSCI, { bold: true });
  y = row(doc, y, "SIREN", settings.siren || "Non renseigne");
  y = row(doc, y, "Adresse du siege", settings.adresseSiege || "Non renseigne");
  y = row(doc, y, "Regime fiscal", `SC a l'${settings.regimeFiscal}`);
  y = row(doc, y, "Exercice", `01/01/${annee} au 31/12/${annee}`);
  y = row(doc, y, "Nombre d'associes", String(settings.associes?.length ?? 0));
  y += 4;

  // Cadre II — Immeubles
  y = sectionTitle(doc, y, "Cadre II — Liste des immeubles");

  const propCols = [
    { label: "Bien", x: M, w: 60 },
    { label: "Adresse", x: M + 60, w: 55 },
    { label: "Type", x: M + 115, w: 30 },
    { label: "Acquisition", x: M + 145, w: 29, align: "right" as const },
  ];
  y = tableHeader(doc, y, propCols);

  for (const p of biens) {
    if (y > PH - 30) { pageFooter(doc, 1, totalPages, settings.nomSCI); doc.addPage(); pageHeader(doc, settings.nomSCI, annee); y = 22; }
    y = tableRow(doc, y, [
      { value: p.nom, x: M, w: 60, bold: true },
      { value: (p.adresse || "").slice(0, 35), x: M + 60, w: 55 },
      { value: TYPE_BIEN_LABELS[p.type] || p.type, x: M + 115, w: 30 },
      { value: getPropertyAcquisitionDate(p).slice(0, 10), x: M + 145, w: 29, align: "right" },
    ]);
  }

  pageFooter(doc, 1, totalPages, settings.nomSCI);

  // ═══════════════════════════════════════════
  // PAGE 2 — Revenus et Charges
  // ═══════════════════════════════════════════

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee);
  y = 22;

  // Cadre III — Revenus
  y = sectionTitle(doc, y, "Cadre III — Revenus des proprietes");

  for (const r of bilan.rows) {
    y = row(doc, y, r.propertyNom, eur(r.revenusLocatifs), { indent: 4 });
  }
  dashed(doc, y);
  y += 2;
  y = row(doc, y, "TOTAL REVENUS BRUTS", eur(bilan.totaux.revenusLocatifs), { bold: true });
  y += 4;

  // Cadre IV — Charges
  y = sectionTitle(doc, y, "Cadre IV — Charges de la propriete");

  // Detail charges (consolidated)
  const cd = bilan.totaux.chargesDetail;
  y = row(doc, y, "Frais d'administration et de gestion", eur(cd.fraisGestion), { indent: 4 });
  y = row(doc, y, "Charges de copropriete", eur(cd.copropriete), { indent: 4 });
  y = row(doc, y, "Primes d'assurance (PNO)", eur(cd.assurancePNO), { indent: 4 });
  y = row(doc, y, "Taxe fonciere", eur(cd.taxeFonciere), { indent: 4 });
  y = row(doc, y, "Travaux et entretien", eur(cd.travauxEntretien), { indent: 4 });
  y = row(doc, y, "Autres charges", eur(cd.autresCharges), { indent: 4 });
  dashed(doc, y);
  y += 2;
  y = row(doc, y, "TOTAL CHARGES (hors interets)", eur(bilan.totaux.chargesDeductibles), { bold: true });
  y += 4;

  // Interets d'emprunt
  y = sectionTitle(doc, y, "Interets d'emprunt");
  for (const r of bilan.rows) {
    if (r.interetsEmprunt > 0 || r.assuranceEmprunt > 0) {
      y = row(doc, y, `${r.propertyNom} — Interets`, eur(r.interetsEmprunt), { indent: 4 });
      y = row(doc, y, `${r.propertyNom} — Assurance emprunt`, eur(r.assuranceEmprunt), { indent: 4 });
    }
  }
  dashed(doc, y);
  y += 2;
  y = row(doc, y, "TOTAL INTERETS + ASSURANCE", eur(bilan.totaux.interetsEmprunt + bilan.totaux.assuranceEmprunt), { bold: true });
  y += 4;

  // Detail par immeuble
  if (bilan.rows.length > 1) {
    y = sectionTitle(doc, y, "Detail par immeuble");
    const detailCols = [
      { label: "Bien", x: M, w: 45 },
      { label: "Revenus", x: M + 45, w: 25, align: "right" as const },
      { label: "Charges", x: M + 70, w: 25, align: "right" as const },
      { label: "Interets", x: M + 95, w: 25, align: "right" as const },
      { label: "Assurance", x: M + 120, w: 25, align: "right" as const },
      { label: "Resultat", x: M + 145, w: 29, align: "right" as const },
    ];
    y = tableHeader(doc, y, detailCols);
    for (const r of bilan.rows) {
      y = tableRow(doc, y, [
        { value: r.propertyNom, x: M, w: 45, bold: true },
        { value: eur(r.revenusLocatifs), x: M + 45, w: 25, align: "right" },
        { value: eur(-r.chargesDeductibles), x: M + 70, w: 25, align: "right" },
        { value: eur(-r.interetsEmprunt), x: M + 95, w: 25, align: "right" },
        { value: eur(-r.assuranceEmprunt), x: M + 120, w: 25, align: "right" },
        { value: eur(r.resultatFiscal), x: M + 145, w: 29, align: "right", bold: true },
      ]);
    }
  }

  pageFooter(doc, 2, totalPages, settings.nomSCI);

  // ═══════════════════════════════════════════
  // PAGE 3 — Resultat + Repartition associes
  // ═══════════════════════════════════════════

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee);
  y = 22;

  // Cadre V — Resultat
  y = sectionTitle(doc, y, "Cadre V — Determination du resultat net");

  y = row(doc, y, "Total revenus bruts", eur(bilan.totaux.revenusLocatifs));
  y = row(doc, y, "Total charges deductibles", eur(-bilan.totaux.chargesDeductibles));
  y = row(doc, y, "Total interets d'emprunt", eur(-bilan.totaux.interetsEmprunt));
  y = row(doc, y, "Total assurance emprunt", eur(-bilan.totaux.assuranceEmprunt));
  if (bilan.regime === "IS") {
    y = row(doc, y, "Total amortissements", eur(-bilan.totaux.amortissements));
  }
  dashed(doc, y);
  y += 2;
  const resultColor = bilan.totaux.resultatFiscal >= 0 ? C.dark : C.red;
  y = row(doc, y, "RESULTAT NET FISCAL", eur(bilan.totaux.resultatFiscal), { bold: true, color: resultColor });
  y += 2;
  y = row(doc, y, "Impot estime", eur(bilan.totaux.impotEstime), { bold: true });
  y += 8;

  // Cadre VI — Repartition entre associes
  const associes = settings.associes ?? [];
  if (associes.length > 0) {
    y = sectionTitle(doc, y, "Cadre VI — Repartition du resultat entre les associes");
    y += 1;

    doc.setFontSize(7);
    doc.setFont("courier", "normal");
    doc.setTextColor(...C.muted);
    doc.text("A reporter sur la declaration 2044 de chaque associe (revenus fonciers).", M + 2, y);
    y += 6;

    const assoCols = [
      { label: "Associe", x: M, w: 60 },
      { label: "Quote-part", x: M + 60, w: 35, align: "right" as const },
      { label: "Resultat", x: M + 95, w: 40, align: "right" as const },
      { label: "Impot estime", x: M + 135, w: 39, align: "right" as const },
    ];
    y = tableHeader(doc, y, assoCols);

    for (const a of associes) {
      const qp = a.quotePart / 100;
      const resultatPart = Math.round(bilan.totaux.resultatFiscal * qp);
      const impotPart = Math.round(bilan.totaux.impotEstime * qp);
      y = tableRow(doc, y, [
        { value: a.nom, x: M, w: 60, bold: true },
        { value: `${a.quotePart} %`, x: M + 60, w: 35, align: "right" },
        { value: eur(resultatPart), x: M + 95, w: 40, align: "right", bold: true },
        { value: eur(impotPart), x: M + 135, w: 39, align: "right" },
      ]);
    }

    dashed(doc, y + 1);
    y += 4;
    y = tableRow(doc, y, [
      { value: "TOTAL", x: M, w: 60, bold: true },
      { value: "100 %", x: M + 60, w: 35, align: "right", bold: true },
      { value: eur(bilan.totaux.resultatFiscal), x: M + 95, w: 40, align: "right", bold: true },
      { value: eur(bilan.totaux.impotEstime), x: M + 135, w: 39, align: "right", bold: true },
    ]);
  }

  y += 12;

  // Signature block
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`Fait a ${settings.adresseSiege ? settings.adresseSiege.split(",").pop()?.trim() || "" : "_______________"}`, M + 2, y);
  y += 5;
  doc.text(`Le ${new Date().toLocaleDateString("fr-FR")}`, M + 2, y);
  y += 10;
  doc.text("Signature du gerant :", M + 2, y);

  pageFooter(doc, 3, totalPages, settings.nomSCI);

  // ── Watermark if missing data ──
  if (missingData.length > 0) {
    applyWatermark(doc);
  }

  // ── Save ──
  const filename = `2072-S_${settings.nomSCI.replace(/\s+/g, "_")}_${annee}.pdf`;
  doc.save(filename);
}
