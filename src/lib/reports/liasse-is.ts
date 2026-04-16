import type jsPDF from "jspdf";
import type { DonneesApp } from "@/types";
import { TYPE_BIEN_LABELS } from "@/types";
import { computeBilanFiscal } from "@/lib/calculations/fiscal-bilan";
import { calculerAmortissementAnnee } from "@/lib/calculations/tax-is";
import { crdEnFinAnnee } from "@/lib/calculations/loan";
import { getPropertyAcquisitionDate } from "@/lib/utils";

// ── Layout ──

const M = 18;
const PW = 210;
const PH = 297;

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

function section(doc: jsPDF, y: number, title: string): number {
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

function tableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; w: number; align?: "right" }[]): number {
  doc.setFontSize(6.5);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.teal);
  for (const col of cols) {
    if (col.align === "right") doc.text(col.label, col.x + col.w - 2, y, { align: "right" });
    else doc.text(col.label, col.x + 2, y);
  }
  dashed(doc, y + 1.5);
  return y + 5;
}

function tableRow(doc: jsPDF, y: number, cols: { value: string; x: number; w: number; align?: "right"; bold?: boolean }[]): number {
  doc.setFontSize(7.5);
  for (const col of cols) {
    doc.setFont("courier", col.bold ? "bold" : "normal");
    doc.setTextColor(...(col.bold ? C.dark : C.muted));
    if (col.align === "right") doc.text(col.value, col.x + col.w - 2, y, { align: "right" });
    else doc.text(col.value, col.x + 2, y);
  }
  return y + 4.5;
}

function pageHeader(doc: jsPDF, nomSCI: string, annee: number, formRef: string) {
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 3, "F");
  doc.setFontSize(7);
  doc.setFont("courier", "bold");
  doc.setTextColor(...C.primary);
  doc.text(`LIASSE FISCALE IS — ${nomSCI}`, M, 10);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`${formRef} · Exercice ${annee}`, PW - M, 10, { align: "right" });
  dashed(doc, 14);
}

function pageFooter(doc: jsPDF, page: number, total: number, nomSCI: string) {
  dashed(doc, PH - 15);
  doc.setFontSize(6);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`${nomSCI} — Liasse fiscale IS`, M, PH - 10);
  doc.text(`${page}/${total}`, PW - M, PH - 10, { align: "right" });
}

// ── Missing data detection ──

function detectMissing(data: DonneesApp, bilan: ReturnType<typeof computeBilanFiscal>): boolean {
  if (!data.settings.siren) return true;
  if (!data.settings.adresseSiege) return true;
  if (bilan.totaux.revenusLocatifs === 0 && data.properties.length > 0) return true;
  if ((data.settings.associes ?? []).length === 0) return true;
  return false;
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
    const cx = PW / 2;
    const cy = PH / 2;
    doc.text("SIMULATION ONLY", cx, cy - 10, { align: "center", angle: -35 });
    doc.text("MISSING DATA", cx, cy + 12, { align: "center", angle: -35 });
    doc.restoreGraphicsState();
  }
}

// ── Main generator ──

export async function generateLiasseIS(data: DonneesApp, annee: number): Promise<void> {
  const { settings } = data;
  const bilan = computeBilanFiscal(data, annee);
  const properties = data.properties.filter(p => !p.deletedAt);
  const loans = data.loans;
  const missing = detectMissing(data, bilan);

  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  doc.setFont("courier");
  const totalPages = 5;

  // ═══ PAGE 1 — 2065 Déclaration de résultat ═══

  pageHeader(doc, settings.nomSCI, annee, "2065-SD");
  let y = 22;

  y = section(doc, y, "Identification de la societe");
  y = row(doc, y, "Denomination", settings.nomSCI, { bold: true });
  y = row(doc, y, "SIREN", settings.siren || "Non renseigne");
  y = row(doc, y, "Siege social", settings.adresseSiege || "Non renseigne");
  y = row(doc, y, "Regime fiscal", "SC a l'IS");
  y = row(doc, y, "Capital social", eur(settings.capitalSocial ?? 0));
  y = row(doc, y, "Exercice", `01/01/${annee} au 31/12/${annee}`);
  y = row(doc, y, "Associes", String(settings.associes?.length ?? 0));
  y += 4;

  y = section(doc, y, "Resultat fiscal");
  y = row(doc, y, "Resultat comptable", eur(bilan.totaux.resultatFiscal));
  const isResult = bilan.totaux.resultatFiscal;
  if (isResult > 0) {
    y = row(doc, y, "IS a payer", eur(bilan.totaux.impotEstime), { bold: true });
    y = row(doc, y, "  dont taux reduit 15% (≤ 42 500 EUR)", eur(Math.min(isResult, 42500) * 0.15), { indent: 4 });
    if (isResult > 42500) {
      y = row(doc, y, "  dont taux normal 25%", eur((isResult - 42500) * 0.25), { indent: 4 });
    }
  } else {
    y = row(doc, y, "Deficit reportable", eur(Math.abs(isResult)), { color: C.red });
    y = row(doc, y, "IS a payer", eur(0));
  }
  y += 4;

  y = section(doc, y, "Repartition du resultat entre les associes");
  const associes = settings.associes ?? [];
  for (const a of associes) {
    const qp = a.quotePart / 100;
    y = row(doc, y, `${a.nom} (${a.quotePart}%)`, eur(Math.round(isResult * qp)), { indent: 4 });
  }
  y += 4;

  y = section(doc, y, "Liste des immeubles");
  for (const p of properties) {
    y = row(doc, y, p.nom, `${TYPE_BIEN_LABELS[p.type]} · ${p.adresse?.slice(0, 40) || ""}`, { indent: 4 });
  }

  pageFooter(doc, 1, totalPages, settings.nomSCI);

  // ═══ PAGE 2 — 2033-A Bilan simplifié ═══

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee, "2033-A Bilan simplifie");
  y = 22;

  // ACTIF
  y = section(doc, y, "Actif");

  // Immobilisations
  y = row(doc, y, "IMMOBILISATIONS CORPORELLES", "", { bold: true });
  let totalImmoBrut = 0;
  let totalAmortCumule = 0;

  for (const p of properties) {
    const fraisNotaire = p.fraisNotaire ?? (p.prixAchat * 0.08);
    const brut = p.prixAchat + fraisNotaire + (p.fraisAgence ?? 0) + p.montantTravaux + (p.montantMobilier ?? 0);
    totalImmoBrut += brut;

    // Cumulative amortization
    const purchaseYear = parseInt(getPropertyAcquisitionDate(p).slice(0, 4));
    let amortCumul = 0;
    const inputs = {
      prixAchat: p.prixAchat, fraisAgence: p.fraisAgence ?? 0,
      montantTravaux: p.montantTravaux, lotsTravaux: [],
      lotsMobilier: (p.montantMobilier ?? 0) > 0 ? [{ id: '0', nom: 'Mobilier', montant: p.montantMobilier ?? 0 }] : [],
    };
    for (let yr = 1; yr <= annee - purchaseYear + 1; yr++) {
      amortCumul += calculerAmortissementAnnee(inputs as unknown as Parameters<typeof calculerAmortissementAnnee>[0], fraisNotaire, yr);
    }
    totalAmortCumule += amortCumul;

    y = row(doc, y, `  ${p.nom}`, `Brut: ${eur(brut)} | Amort: ${eur(Math.round(amortCumul))} | Net: ${eur(Math.round(brut - amortCumul))}`, { indent: 4 });
  }

  dashed(doc, y); y += 2;
  y = row(doc, y, "Total immobilisations (brut)", eur(totalImmoBrut), { bold: true });
  y = row(doc, y, "Total amortissements cumules", eur(Math.round(totalAmortCumule)));
  y = row(doc, y, "Total immobilisations (net)", eur(Math.round(totalImmoBrut - totalAmortCumule)), { bold: true });
  y += 2;

  // Actif circulant
  y = row(doc, y, "ACTIF CIRCULANT", "", { bold: true });
  // Impayés = créances
  const impayes = (data.rentTracking ?? [])
    .filter(r => r.yearMonth.startsWith(String(annee)) && (r.statut === "impaye" || (r.statut === "partiel" && r.partielRaison !== "vacance_partielle")))
    .reduce((s, r) => s + Math.max(0, r.loyerAttendu - r.loyerPercu), 0);
  y = row(doc, y, "  Creances clients (impayes)", eur(Math.round(impayes)), { indent: 4 });

  dashed(doc, y); y += 2;
  y = row(doc, y, "TOTAL ACTIF", eur(Math.round(totalImmoBrut - totalAmortCumule + impayes)), { bold: true });
  y += 6;

  // PASSIF
  y = section(doc, y, "Passif");

  y = row(doc, y, "Capital social", eur(settings.capitalSocial ?? 0));

  // Report à nouveau (simplified: sum of prior years results)
  let reportANouveau = 0;
  for (let yr = annee - 1; yr >= annee - 10; yr--) {
    const priorBilan = computeBilanFiscal(data, yr);
    if (priorBilan.rows.length > 0) {
      reportANouveau += priorBilan.totaux.resultatFiscal - priorBilan.totaux.impotEstime;
    }
  }
  y = row(doc, y, "Report a nouveau", eur(Math.round(reportANouveau)));
  y = row(doc, y, "Resultat de l'exercice", eur(bilan.totaux.resultatFiscal), { color: bilan.totaux.resultatFiscal >= 0 ? C.dark : C.red });

  // Emprunts (defer-aware via crdEnFinAnnee)
  let totalCRD = 0;
  for (const loan of loans) {
    const loanStart = parseInt(loan.dateDebut.slice(0, 4));
    const yearsElapsed = annee - loanStart + 1;
    if (yearsElapsed >= 1 && yearsElapsed <= loan.dureeAnnees) {
      totalCRD += crdEnFinAnnee(loan, yearsElapsed);
    }
  }
  y = row(doc, y, "Emprunts et dettes", eur(Math.round(totalCRD)));

  dashed(doc, y); y += 2;
  y = row(doc, y, "TOTAL PASSIF", eur(Math.round((settings.capitalSocial ?? 0) + reportANouveau + bilan.totaux.resultatFiscal + totalCRD)), { bold: true });

  pageFooter(doc, 2, totalPages, settings.nomSCI);

  // ═══ PAGE 3 — 2033-B Compte de résultat ═══

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee, "2033-B Compte de resultat");
  y = 22;

  y = section(doc, y, "Produits d'exploitation");
  for (const r of bilan.rows) {
    y = row(doc, y, `  ${r.propertyNom} — Loyers`, eur(r.revenusLocatifs), { indent: 4 });
  }
  dashed(doc, y); y += 2;
  y = row(doc, y, "Total produits", eur(bilan.totaux.revenusLocatifs), { bold: true });
  y += 4;

  y = section(doc, y, "Charges d'exploitation");
  const cd = bilan.totaux.chargesDetail;
  y = row(doc, y, "Taxe fonciere", eur(cd.taxeFonciere), { indent: 4 });
  y = row(doc, y, "Assurance PNO", eur(cd.assurancePNO), { indent: 4 });
  y = row(doc, y, "Charges de copropriete", eur(cd.copropriete), { indent: 4 });
  y = row(doc, y, "Frais de gestion", eur(cd.fraisGestion), { indent: 4 });
  y = row(doc, y, "Travaux et entretien", eur(cd.travauxEntretien), { indent: 4 });
  y = row(doc, y, "Autres charges", eur(cd.autresCharges), { indent: 4 });
  dashed(doc, y); y += 2;
  y = row(doc, y, "Total charges d'exploitation", eur(bilan.totaux.chargesDeductibles), { bold: true });
  y += 4;

  y = section(doc, y, "Charges financieres");
  y = row(doc, y, "Interets d'emprunt", eur(bilan.totaux.interetsEmprunt), { indent: 4 });
  y = row(doc, y, "Assurance emprunt", eur(bilan.totaux.assuranceEmprunt), { indent: 4 });
  dashed(doc, y); y += 2;
  y = row(doc, y, "Total charges financieres", eur(bilan.totaux.interetsEmprunt + bilan.totaux.assuranceEmprunt), { bold: true });
  y += 4;

  y = section(doc, y, "Dotations aux amortissements");
  y = row(doc, y, "Amortissements de l'exercice", eur(bilan.totaux.amortissements), { indent: 4 });
  y += 4;

  y = section(doc, y, "Resultat");
  const totalCharges = bilan.totaux.chargesDeductibles + bilan.totaux.interetsEmprunt + bilan.totaux.assuranceEmprunt + bilan.totaux.amortissements;
  y = row(doc, y, "Total produits", eur(bilan.totaux.revenusLocatifs));
  y = row(doc, y, "Total charges", eur(totalCharges));
  dashed(doc, y); y += 2;
  const resultColor = bilan.totaux.resultatFiscal >= 0 ? C.dark : C.red;
  y = row(doc, y, "RESULTAT FISCAL", eur(bilan.totaux.resultatFiscal), { bold: true, color: resultColor });
  y = row(doc, y, "IS estime", eur(bilan.totaux.impotEstime), { bold: true });

  pageFooter(doc, 3, totalPages, settings.nomSCI);

  // ═══ PAGE 4 — 2033-C Immobilisations & Amortissements ═══

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee, "2033-C Immobilisations & Amortissements");
  y = 22;

  y = section(doc, y, "Tableau des immobilisations");

  const immoCols = [
    { label: "Immobilisation", x: M, w: 55 },
    { label: "Date acq.", x: M + 55, w: 22, align: "right" as const },
    { label: "Valeur brute", x: M + 77, w: 28, align: "right" as const },
    { label: "Duree", x: M + 105, w: 15, align: "right" as const },
    { label: "Dot. annee", x: M + 120, w: 27, align: "right" as const },
    { label: "Amort. cumul", x: M + 147, w: 27, align: "right" as const },
  ];
  y = tableHeader(doc, y, immoCols);

  let totalDotation = 0;
  let totalAmortCumuleDetail = 0;

  for (const p of properties) {
    const fraisNotaire = p.fraisNotaire ?? (p.prixAchat * 0.08);
    const purchaseYear = parseInt(getPropertyAcquisitionDate(p).slice(0, 4));
    const yearsOwned = annee - purchaseYear + 1;
    if (yearsOwned < 1) continue;

    const inputs = {
      prixAchat: p.prixAchat, fraisAgence: p.fraisAgence ?? 0,
      montantTravaux: p.montantTravaux, lotsTravaux: [],
      lotsMobilier: (p.montantMobilier ?? 0) > 0 ? [{ id: '0', nom: 'Mobilier', montant: p.montantMobilier ?? 0 }] : [],
    } as unknown as Parameters<typeof calculerAmortissementAnnee>[0];
    const dotAnnee = calculerAmortissementAnnee(inputs, fraisNotaire, yearsOwned);
    let amortCumul = 0;
    for (let yr = 1; yr <= yearsOwned; yr++) amortCumul += calculerAmortissementAnnee(inputs, fraisNotaire, yr);

    // Composantes
    const composantes = [
      { nom: "Batiment (80%)", brut: p.prixAchat * 0.80, duree: 25 },
      { nom: "Terrain (20%)", brut: p.prixAchat * 0.20, duree: 0 },
      { nom: "Frais notaire", brut: fraisNotaire, duree: 1 },
    ];
    if ((p.fraisAgence ?? 0) > 0) composantes.push({ nom: "Frais agence", brut: p.fraisAgence ?? 0, duree: 1 });
    if (p.montantTravaux > 0) composantes.push({ nom: "Travaux", brut: p.montantTravaux, duree: 18 });
    if ((p.montantMobilier ?? 0) > 0) composantes.push({ nom: "Mobilier", brut: p.montantMobilier ?? 0, duree: 7 });

    // Bien header
    y = tableRow(doc, y, [
      { value: p.nom, x: M, w: 55, bold: true },
      { value: getPropertyAcquisitionDate(p).slice(0, 10), x: M + 55, w: 22, align: "right" },
      { value: "", x: M + 77, w: 28, align: "right" },
      { value: "", x: M + 105, w: 15, align: "right" },
      { value: eur(Math.round(dotAnnee)), x: M + 120, w: 27, align: "right", bold: true },
      { value: eur(Math.round(amortCumul)), x: M + 147, w: 27, align: "right", bold: true },
    ]);
    totalDotation += dotAnnee;
    totalAmortCumuleDetail += amortCumul;

    for (const c of composantes) {
      const cDot = c.duree > 0 && yearsOwned <= c.duree ? c.brut / c.duree : 0;
      const cCumul = c.duree > 0 ? c.brut / c.duree * Math.min(yearsOwned, c.duree) : 0;
      y = tableRow(doc, y, [
        { value: `  ${c.nom}`, x: M, w: 55 },
        { value: "", x: M + 55, w: 22, align: "right" },
        { value: eur(Math.round(c.brut)), x: M + 77, w: 28, align: "right" },
        { value: c.duree > 0 ? `${c.duree}a` : "—", x: M + 105, w: 15, align: "right" },
        { value: eur(Math.round(cDot)), x: M + 120, w: 27, align: "right" },
        { value: eur(Math.round(cCumul)), x: M + 147, w: 27, align: "right" },
      ]);
      if (y > PH - 30) { pageFooter(doc, 4, totalPages, settings.nomSCI); doc.addPage(); pageHeader(doc, settings.nomSCI, annee, "2033-C (suite)"); y = 22; }
    }
    y += 2;
  }

  dashed(doc, y); y += 2;
  y = row(doc, y, "TOTAL dotation de l'exercice", eur(Math.round(totalDotation)), { bold: true });
  y = row(doc, y, "TOTAL amortissements cumules", eur(Math.round(totalAmortCumuleDetail)), { bold: true });

  pageFooter(doc, 4, totalPages, settings.nomSCI);

  // ═══ PAGE 5 — 2033-D Déficits reportables ═══

  doc.addPage();
  pageHeader(doc, settings.nomSCI, annee, "2033-D Deficits reportables");
  y = 22;

  y = section(doc, y, "Report des deficits anterieurs");

  let deficitCumule = 0;
  const startYear = Math.max(annee - 10, 2015);
  for (let yr = startYear; yr < annee; yr++) {
    const priorBilan = computeBilanFiscal(data, yr);
    if (priorBilan.rows.length === 0) continue;
    const res = priorBilan.totaux.resultatFiscal;
    if (res < 0) {
      y = row(doc, y, `Deficit ${yr}`, eur(Math.abs(res)), { indent: 4, color: C.red });
      deficitCumule += Math.abs(res);
    }
  }

  if (deficitCumule === 0) {
    y = row(doc, y, "Aucun deficit reportable", "—", { indent: 4 });
  }

  dashed(doc, y); y += 2;
  y = row(doc, y, "Total deficits reportables", eur(deficitCumule), { bold: true, color: deficitCumule > 0 ? C.red : C.dark });
  y += 4;

  y = section(doc, y, "Resultat de l'exercice " + annee);
  y = row(doc, y, "Resultat avant report", eur(bilan.totaux.resultatFiscal));
  y = row(doc, y, "Imputation deficits", eur(Math.min(deficitCumule, Math.max(0, bilan.totaux.resultatFiscal))));
  const resultatApresReport = bilan.totaux.resultatFiscal - Math.min(deficitCumule, Math.max(0, bilan.totaux.resultatFiscal));
  y = row(doc, y, "Resultat apres imputation", eur(Math.round(resultatApresReport)), { bold: true });
  y += 8;

  // Signature
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`Fait a ${settings.adresseSiege ? settings.adresseSiege.split(",").pop()?.trim() || "" : "_______________"}`, M + 2, y);
  y += 5;
  doc.text(`Le ${new Date().toLocaleDateString("fr-FR")}`, M + 2, y);
  y += 10;
  doc.text("Signature du gerant :", M + 2, y);

  pageFooter(doc, 5, totalPages, settings.nomSCI);

  // Watermark if data is missing
  if (missing) applyWatermark(doc);

  // Save
  const filename = `Liasse_IS_${settings.nomSCI.replace(/\s+/g, "_")}_${annee}.pdf`;
  doc.save(filename);
}
