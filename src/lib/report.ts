import jsPDF from "jspdf";
import type { CalculatorInputs, CalculatorResults } from "@/types";
import { AMORT_DUREES } from "@/types";

const M = 18;
const PW = 210;
const PH = 297;
const CW = PW - M * 2;

const C = {
  primary: [204, 42, 65] as [number, number, number],
  teal: [86, 124, 119] as [number, number, number],
  dark: [34, 39, 42] as [number, number, number],
  muted: [102, 102, 102] as [number, number, number],
  border: [180, 180, 180] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [180, 30, 30] as [number, number, number],
};

function eur(v: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
}

function pct(v: number, d = 2): string { return `${v.toFixed(d)} %`; }

function dashed(doc: jsPDF, y: number, x1 = M, x2 = PW - M) {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function row(doc: jsPDF, y: number, label: string, value: string, opts?: { bold?: boolean; x?: number; w?: number; color?: [number, number, number] }): number {
  const x = opts?.x ?? M;
  const right = x + (opts?.w ?? CW);
  doc.setFontSize(8);
  doc.setFont("courier", opts?.bold ? "bold" : "normal");
  doc.setTextColor(...(opts?.color ?? (opts?.bold ? C.dark : C.muted)));
  doc.text(label, x + 2, y);
  doc.text(value, right - 2, y, { align: "right" });
  doc.setFont("courier", "normal");
  return y + 4.5;
}

function heading(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(8);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.teal);
  doc.text(title.toUpperCase(), M, y);
  dashed(doc, y + 1.5);
  return y + 6;
}

function headingAt(doc: jsPDF, y: number, title: string, x: number, w: number): number {
  doc.setFontSize(8);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.teal);
  doc.text(title.toUpperCase(), x, y);
  dashed(doc, y + 1.5, x, x + w);
  return y + 6;
}

function kpi(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, color?: [number, number, number]) {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "S");
  doc.setLineDashPattern([], 0);
  doc.setFontSize(5.5);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(label, x + w / 2, y + 4, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("courier", "bold");
  doc.setTextColor(...(color ?? C.dark));
  doc.text(value, x + w / 2, y + h - 3, { align: "center" });
}

function pageHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 3, "F");
  doc.setFontSize(7);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.primary);
  doc.text(title, M, 10);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(subtitle, PW - M, 10, { align: "right" });
  dashed(doc, 14);
}

function footer(doc: jsPDF, page: number, total: number) {
  dashed(doc, PH - 15);
  doc.setFontSize(6);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text("SCI Immobilier", M, PH - 10);
  doc.text(`${page}/${total}`, PW - M, PH - 10, { align: "right" });
}

// ─────────────────────────────────────────────

export async function generateReport(inputs: CalculatorInputs, results: CalculatorResults): Promise<void> {

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("courier");

  const mobilierTotal = (inputs.lotsMobilier ?? []).reduce((s, l) => s + (l.montant || 0), 0);
  const travauxTotal = (inputs.lotsTravaux ?? []).reduce((s, l) => s + (l.montant || 0), 0) || inputs.montantTravaux;
  const lotsTotal = (inputs.lots ?? []).reduce((s, l) => s + (l.loyerMensuel || 0), 0);
  const cfColor = results.cashFlowMensuelApresImpot >= 0 ? C.green : C.red;
  const totalPages = 2;
  const colW = (CW - 4) / 2;
  const colL = M;
  const colR = M + colW + 4;

  // ═══════════════════════════════════════════
  // PAGE 1: COVER + PROJECT SUMMARY
  // ═══════════════════════════════════════════

  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 3, "F");

  let y = 10;
  doc.setFontSize(7);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.primary);
  doc.text("DOSSIER DE FINANCEMENT — INVESTISSEMENT LOCATIF", M, y);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(new Date().toLocaleDateString("fr-FR"), PW - M, y, { align: "right" });
  y += 6;
  dashed(doc, y);
  y += 6;

  // Photo + info
  const photoW = 65;
  const infoW = inputs.photo ? CW - photoW - 5 : CW;

  doc.setFontSize(18);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.primary);
  const nameLines = doc.splitTextToSize(inputs.nomSimulation || "Projet immobilier", infoW);
  doc.text(nameLines, M, y + 5);
  let infoY = y + 5 + nameLines.length * 7;

  if (inputs.adresse) {
    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    doc.setTextColor(...C.muted);
    doc.text(inputs.adresse, M, infoY);
    infoY += 5;
  }
  if (inputs.surfaceM2 > 0) {
    doc.text(`${inputs.surfaceM2} m2 — ${Math.round(inputs.prixAchat / inputs.surfaceM2).toLocaleString("fr-FR")} EUR/m2`, M, infoY);
    infoY += 5;
  }

  if (inputs.photo) {
    try { doc.addImage(inputs.photo, "JPEG", PW - M - photoW, y - 2, photoW, 40, undefined, "MEDIUM"); } catch { /* */ }
  }

  y = Math.max(infoY, y + (inputs.photo ? 42 : 5)) + 3;

  // 6 KPIs
  const kW = CW / 6;
  kpi(doc, M, y, kW - 1.5, 15, "Rdt brut", pct(results.rendementBrut));
  kpi(doc, M + kW, y, kW - 1.5, 15, "Rdt net", pct(results.rendementNet));
  kpi(doc, M + kW * 2, y, kW - 1.5, 15, "Rdt net-net", pct(results.rendementNetNet));
  kpi(doc, M + kW * 3, y, kW - 1.5, 15, "Cash flow/m", eur(results.cashFlowMensuelApresImpot), cfColor);
  kpi(doc, M + kW * 4, y, kW - 1.5, 15, "TAEG (estime)", pct(results.taeg));
  kpi(doc, M + kW * 5, y, kW - 1.5, 15, `TRI ${results.projection.length}a`, pct(results.tri), results.tri > 0 ? C.green : C.red);
  y += 22;

  // Acquisition | Financement
  let yL = headingAt(doc, y, "Acquisition", colL, colW);
  yL = row(doc, yL, "Prix d'achat", eur(inputs.prixAchat), { x: colL, w: colW });
  yL = row(doc, yL, "Frais de notaire", eur(inputs.prixAchat * inputs.fraisNotairePct), { x: colL, w: colW });
  if (inputs.fraisAgence) yL = row(doc, yL, "Frais d'agence", eur(inputs.fraisAgence), { x: colL, w: colW });
  if (travauxTotal > 0) yL = row(doc, yL, "Travaux", eur(travauxTotal), { x: colL, w: colW });
  if (mobilierTotal > 0) yL = row(doc, yL, "Mobilier", eur(mobilierTotal), { x: colL, w: colW });
  if (inputs.fraisDossier) yL = row(doc, yL, "Frais de dossier", eur(inputs.fraisDossier), { x: colL, w: colW });
  if (inputs.fraisCourtage) yL = row(doc, yL, "Frais de courtage", eur(inputs.fraisCourtage), { x: colL, w: colW });
  yL = row(doc, yL, "Cout total projet", eur(results.coutTotalAcquisition), { x: colL, w: colW, bold: true });

  let yR = headingAt(doc, y, "Financement", colR, colW);
  yR = row(doc, yR, "Apport personnel", eur(inputs.apportPersonnel), { x: colR, w: colW });
  yR = row(doc, yR, "Montant emprunte", eur(inputs.montantEmprunte), { x: colR, w: colW });
  yR = row(doc, yR, "Taux nominal (estime)", pct(inputs.tauxCredit * 100), { x: colR, w: colW });
  yR = row(doc, yR, "Duree", `${inputs.dureeCredit} ans`, { x: colR, w: colW });
  if (inputs.differePretMois > 0) yR = row(doc, yR, "Differe partiel", `${inputs.differePretMois} mois`, { x: colR, w: colW });
  yR = row(doc, yR, "Mensualite totale", eur(results.mensualiteCredit), { x: colR, w: colW, bold: true });
  yR = row(doc, yR, "TAEG (estime)", pct(results.taeg), { x: colR, w: colW });

  y = Math.max(yL, yR) + 4;

  // Revenus | Charges
  yL = headingAt(doc, y, "Revenus locatifs", colL, colW);
  if (inputs.lots && inputs.lots.length > 1) {
    for (const lot of inputs.lots) {
      yL = row(doc, yL, lot.nom, `${eur(lot.loyerMensuel)}/mois`, { x: colL, w: colW });
    }
  }
  yL = row(doc, yL, "Total loyers", `${eur(lotsTotal)}/mois`, { x: colL, w: colW, bold: true });
  yL = row(doc, yL, "Annuel brut", eur(results.loyerAnnuelBrut), { x: colL, w: colW });
  yL = row(doc, yL, "Vacance", `${(inputs.tauxVacance * 100).toFixed(0)}%`, { x: colL, w: colW });
  if (inputs.differeLoyer > 0) yL = row(doc, yL, "Differe loyer", `${inputs.differeLoyer} mois`, { x: colL, w: colW });
  yL = row(doc, yL, "Annuel net", eur(results.loyerAnnuelNet), { x: colL, w: colW, bold: true });

  yR = headingAt(doc, y, "Charges annuelles", colR, colW);
  yR = row(doc, yR, "Copropriete", eur(inputs.chargesCopro), { x: colR, w: colW });
  yR = row(doc, yR, "Taxe fonciere", eur(inputs.taxeFonciere), { x: colR, w: colW });
  yR = row(doc, yR, "Assurance PNO", eur(inputs.assurancePNO), { x: colR, w: colW });
  if (inputs.gestionLocativePct > 0) yR = row(doc, yR, "Gestion locative", `${(inputs.gestionLocativePct * 100).toFixed(0)}%`, { x: colR, w: colW });
  if (inputs.comptabilite > 0) yR = row(doc, yR, "Comptabilite", eur(inputs.comptabilite), { x: colR, w: colW });
  if (inputs.cfeCrl > 0) yR = row(doc, yR, "CFE / CRL", eur(inputs.cfeCrl), { x: colR, w: colW });
  if (inputs.entretien > 0) yR = row(doc, yR, "Entretien", eur(inputs.entretien), { x: colR, w: colW });
  if (inputs.gli > 0) yR = row(doc, yR, "GLI", eur(inputs.gli), { x: colR, w: colW });
  if (inputs.autresChargesAnnuelles > 0) yR = row(doc, yR, "Autres", eur(inputs.autresChargesAnnuelles), { x: colR, w: colW });
  yR = row(doc, yR, "Total charges", eur(results.chargesAnnuellesTotales), { x: colR, w: colW, bold: true });

  y = Math.max(yL, yR) + 4;

  // Fiscalite + Resultats
  yL = headingAt(doc, y, "Fiscalite", colL, colW);
  yL = row(doc, yL, "Regime", `SC a l'${inputs.regimeFiscal}`, { x: colL, w: colW });
  if (inputs.regimeFiscal === "IR") {
    yL = row(doc, yL, "TMI", `${((inputs.trancheMarginalePct ?? 0.30) * 100).toFixed(0)}%`, { x: colL, w: colW });
    yL = row(doc, yL, "Prelevements sociaux", "17,2%", { x: colL, w: colW });
  } else {
    yL = row(doc, yL, "IS", "15% (< 42 500 EUR) / 25%", { x: colL, w: colW });
    // Amortissement summary
    const amortBien = inputs.prixAchat * 0.80 / AMORT_DUREES.bien;
    yL = row(doc, yL, `Amort. bien (${AMORT_DUREES.bien}a)`, eur(amortBien), { x: colL, w: colW });
    if (mobilierTotal > 0) yL = row(doc, yL, `Amort. meubles (${AMORT_DUREES.meubles}a)`, eur(mobilierTotal / AMORT_DUREES.meubles), { x: colL, w: colW });
  }
  yL = row(doc, yL, "Impot annuel an 1", eur(results.impotAnnuel), { x: colL, w: colW, bold: true });

  yR = headingAt(doc, y, "Resultats", colR, colW);
  yR = row(doc, yR, "Cash-flow mensuel avant impot", eur(results.cashFlowMensuelAvantImpot), { x: colR, w: colW });
  yR = row(doc, yR, "Cash-flow mensuel apres impot", eur(results.cashFlowMensuelApresImpot), { x: colR, w: colW, bold: true, color: cfColor });
  yR = row(doc, yR, "Cash-flow annuel avant impot", eur(results.cashFlowAnnuelAvantImpot), { x: colR, w: colW });
  yR = row(doc, yR, "Cash-flow annuel apres impot", eur(results.cashFlowAnnuelApresImpot), { x: colR, w: colW, bold: true, color: cfColor });
  yR += 2;
  const lastP = results.projection[results.projection.length - 1];
  const patrimoineNet = lastP ? lastP.valeurBien - lastP.capitalRestantDu : 0;
  yR = row(doc, yR, `Patrimoine net A${results.projection.length}`, eur(patrimoineNet), { x: colR, w: colW, bold: true });

  footer(doc, 1, totalPages);

  // ═══════════════════════════════════════════
  // PAGE 2: CHARTS + PROJECTION TABLE (portrait, 3 bands)
  // ═══════════════════════════════════════════

  doc.addPage();
  pageHeader(doc, inputs.nomSimulation || "Projet immobilier", "PROJECTION");

  let y2 = 18;

  // Hypotheses / parametres d'evolution
  const evos = inputs.evolutions ?? {};
  const evoLines: string[] = [];
  if (evos.lopiloyer) evoLines.push(`Indexation loyers (IRL): +${(evos.lopiloyer * 100).toFixed(1)}%/an`);
  if (evos.taxeFonciere) evoLines.push(`Taxe fonciere: +${(evos.taxeFonciere * 100).toFixed(1)}%/an`);
  if (evos.chargesCopro) evoLines.push(`Copropriete: +${(evos.chargesCopro * 100).toFixed(1)}%/an`);
  if (evos.assurancePNO) evoLines.push(`Assurance PNO: +${(evos.assurancePNO * 100).toFixed(1)}%/an`);
  if (evos.gestionLocative) evoLines.push(`Gestion locative: +${(evos.gestionLocative * 100).toFixed(1)}%/an`);
  if (evos.gli) evoLines.push(`GLI: +${(evos.gli * 100).toFixed(1)}%/an`);
  if (evos.comptabilite) evoLines.push(`Comptabilite: +${(evos.comptabilite * 100).toFixed(1)}%/an`);
  if (evos.cfeCrl) evoLines.push(`CFE/CRL: +${(evos.cfeCrl * 100).toFixed(1)}%/an`);
  if (evos.entretien) evoLines.push(`Entretien: +${(evos.entretien * 100).toFixed(1)}%/an`);
  if (evos.autresCharges) evoLines.push(`Autres charges: +${(evos.autresCharges * 100).toFixed(1)}%/an`);
  if (inputs.tauxAppreciation) evoLines.push(`Appreciation du bien: +${(inputs.tauxAppreciation * 100).toFixed(1)}%/an`);

  if (evoLines.length > 0) {
    y2 = heading(doc, y2, "Hypotheses de projection");
    doc.setFontSize(7);
    doc.setFont("courier", "normal");
    doc.setTextColor(...C.muted);
    // Display in 2 columns
    const mid = Math.ceil(evoLines.length / 2);
    evoLines.forEach((line, i) => {
      const x = i < mid ? M + 2 : M + CW / 2;
      const yi = i < mid ? i : i - mid;
      doc.text(`• ${line}`, x, y2 + yi * 3.5);
    });
    y2 += Math.ceil(evoLines.length / 2) * 3.5 + 4;
  }

  // Projection table split into 5 bands
  const allYears = results.projection.slice(0, 25);
  const bands = [
    allYears.slice(0, 5),   // A1-A5
    allYears.slice(5, 10),  // A6-A10
    allYears.slice(10, 15), // A11-A15
    allYears.slice(15, 20), // A16-A20
    allYears.slice(20, 25), // A21-A25
  ].filter((b) => b.length > 0);

  const labelColW = 28;
  const fs = 6;

  const ceur = (v: number) => {
    const abs = Math.abs(Math.round(v));
    const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${abs}`;
    return v < 0 ? `-${str}` : str;
  };

  const projRowsDef: { label: string; getter: (p: typeof allYears[0]) => number; bold?: boolean; sep?: boolean }[] = [
    { label: "Revenus nets", getter: (p) => p.loyerNet },
    { label: "Charges", getter: (p) => -p.charges },
    { label: "Remb. emprunt", getter: (p) => -p.mensualitesCredit, bold: true },
    { label: "Impots", getter: (p) => -p.impot },
    { label: "", getter: () => 0, sep: true },
    { label: "Cash-flow/an", getter: (p) => p.cashFlowApresImpot, bold: true },
    { label: "", getter: () => 0, sep: true },
    { label: "Capital restant", getter: (p) => p.capitalRestantDu },
    { label: "Patrimoine net", getter: (p) => p.valeurBien - p.capitalRestantDu, bold: true },
  ];

  for (const band of bands) {
    const nCols = band.length;
    const dataColW = (CW - labelColW) / nCols;

    // Band header
    doc.setFontSize(fs);
    doc.setFont("courier", "bold");
    doc.setTextColor(...C.teal);
    band.forEach((p, i) => {
      doc.text(`A${p.annee}`, M + labelColW + dataColW * i + dataColW / 2, y2, { align: "center" });
    });
    y2 += 1.5;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y2, PW - M, y2);
    doc.setLineDashPattern([], 0);
    y2 += 2.5;

    // Rows
    for (const r of projRowsDef) {
      if (r.sep) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(M, y2 - 0.5, PW - M, y2 - 0.5);
        doc.setLineDashPattern([], 0);
        y2 += 1.5;
        continue;
      }
      doc.setFontSize(fs);
      doc.setFont("courier", r.bold ? "bold" : "normal");
      doc.setTextColor(...(r.bold ? C.dark : C.muted));
      doc.text(r.label, M, y2);
      band.forEach((p, i) => {
        const v = r.getter(p);
        doc.setTextColor(...(v < 0 ? C.red : r.bold ? C.dark : C.muted));
        doc.text(ceur(v), M + labelColW + dataColW * i + dataColW / 2, y2, { align: "center" });
      });
      y2 += 3.2;
    }

    y2 += 3;
  }

  footer(doc, 2, totalPages);

  // Save
  const filename = `dossier-${(inputs.nomSimulation || "projet").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
