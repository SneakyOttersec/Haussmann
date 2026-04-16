import type jsPDF from "jspdf";
import type {
  Bien, Lot, Depense, Revenu, Pret, Intervention,
} from "@/types";
import {
  CATEGORIE_DEPENSE_LABELS, TYPE_BIEN_LABELS, STATUT_BIEN_LABELS,
} from "@/types";
import {
  mensualiteAmortissement, crdAtYearEnd, totalMensualitesAnnee,
  interetsAnneeForLoan, loanDureeTotaleMois,
} from "./calculations/loan";
import { annualiserMontant, coutTotalBien } from "./utils";
import { getCurrentMontant } from "./expenseRevisions";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — "Dossier bancaire" : marine + or, Helvetica sans-serif
// ─────────────────────────────────────────────────────────────────────────────
const M = 22;
const PW = 210;
const PH = 297;
const CW = PW - M * 2;

const C = {
  navy:     [31, 58, 95] as [number, number, number],   // #1F3A5F
  navyDark: [20, 40, 70] as [number, number, number],
  gold:     [176, 141, 87] as [number, number, number], // #B08D57
  goldSoft: [232, 218, 188] as [number, number, number],
  paper:    [250, 250, 246] as [number, number, number],
  text:     [40, 40, 40] as [number, number, number],
  muted:    [110, 110, 110] as [number, number, number],
  light:    [170, 170, 170] as [number, number, number],
  border:   [210, 210, 210] as [number, number, number],
  green:    [46, 125, 50] as [number, number, number],
  red:      [183, 28, 28] as [number, number, number],
  amber:    [198, 143, 0] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
} as const;

// Depense categories already accounted for elsewhere in the model — excluded
// from the "charges d'exploitation" to avoid double counting.
const EXCLUDED_EXPENSE_CATS = new Set(["credit", "vacance", "frais_notaire", "travaux", "ameublement"]);

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
function eur(v: number, opts?: { sign?: boolean }): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(Math.abs(v)).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");
  if (opts?.sign && v > 0) return `+${formatted}`;
  if (v < 0) return `-${formatted}`;
  return formatted;
}
function pct(v: number, d = 1): string { return `${v.toFixed(d)} %`; }
function dateFR(iso: string | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return "—"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function setColor(doc: jsPDF, rgb: readonly [number, number, number], kind: "text" | "draw" | "fill") {
  if (kind === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  if (kind === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  if (kind === "fill") doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function hLine(doc: jsPDF, y: number, color: readonly [number, number, number] = C.border, width = 0.2, x1 = M, x2 = PW - M) {
  setColor(doc, color, "draw");
  doc.setLineWidth(width);
  doc.setLineDashPattern([], 0);
  doc.line(x1, y, x2, y);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  // Number in gold, title in navy, gold accent line under
  setColor(doc, C.navy, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), M, y);
  const titleW = doc.getTextWidth(title.toUpperCase());
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.8);
  doc.setLineDashPattern([], 0);
  doc.line(M, y + 1.8, M + titleW, y + 1.8);
  setColor(doc, C.border, "draw");
  doc.setLineWidth(0.2);
  doc.line(M + titleW + 2, y + 1.8, PW - M, y + 1.8);
  return y + 8;
}

function subsectionTitle(doc: jsPDF, y: number, title: string, x = M): number {
  setColor(doc, C.navy, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), x, y);
  return y + 5;
}

function kvRow(doc: jsPDF, y: number, label: string, value: string, opts?: { bold?: boolean; x?: number; w?: number; color?: readonly [number, number, number] }): number {
  const x = opts?.x ?? M;
  const w = opts?.w ?? CW;
  const bold = opts?.bold ?? false;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, C.muted, "text");
  doc.text(label, x, y);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  setColor(doc, opts?.color ?? (bold ? C.navy : C.text), "text");
  doc.text(value, x + w, y, { align: "right" });
  return y + 5.2;
}

/** Tiny muted footnote label (e.g. "à la date d'édition"). */
function footnote(doc: jsPDF, y: number, text: string, x = M, w = CW): number {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setColor(doc, C.light, "text");
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, x, y);
  return y + lines.length * 3.2;
}

function kpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, opts?: { color?: readonly [number, number, number]; hint?: string }) {
  // Border
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 1, 1, "S");
  // Label
  setColor(doc, C.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(label.toUpperCase(), x + w / 2, y + 5, { align: "center" });
  // Value
  setColor(doc, opts?.color ?? C.navy, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(value, x + w / 2, y + h - (opts?.hint ? 7 : 5), { align: "center" });
  // Hint (tiny under value)
  if (opts?.hint) {
    setColor(doc, C.light, "text");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text(opts.hint, x + w / 2, y + h - 2.5, { align: "center" });
  }
}

// Top/bottom page chrome
function pageHeader(doc: jsPDF, propertyName: string, dossierType: string, pageNum: number, totalPages: number) {
  // Thin navy top band
  setColor(doc, C.navy, "fill");
  doc.rect(0, 0, PW, 8, "F");
  // Header text
  setColor(doc, C.white, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`SCI IMMOBILIER · DOSSIER ${dossierType.toUpperCase()}`, M, 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(propertyName.toUpperCase(), PW - M, 5.5, { align: "right" });
  // gold hairline under
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.3);
  doc.line(0, 8, PW, 8);
  // Page number top-right (below band)
  setColor(doc, C.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${pageNum} / ${totalPages}`, PW - M, 13.5, { align: "right" });
}

function pageFooter(doc: jsPDF, date: string) {
  hLine(doc, PH - 12, C.border);
  setColor(doc, C.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("SCI Immobilier · Confidentiel — destiné exclusivement à l'usage du dossier", M, PH - 7);
  doc.text(date, PW - M, PH - 7, { align: "right" });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAN / AMORT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildAmortRows(loan: Pret): Array<[string, string, string, string, string]> {
  const totalMois = loanDureeTotaleMois(loan);
  const totalAnnees = Math.ceil(totalMois / 12);
  const rows: Array<[string, string, string, string, string]> = [];
  for (let a = 1; a <= totalAnnees; a++) {
    const mensAnnee = totalMensualitesAnnee(loan, a);
    const interets = interetsAnneeForLoan(loan, a);
    const mensHorsAss = Math.max(0, mensAnnee - loan.assuranceAnnuelle);
    const capitalRembAnnee = Math.max(0, mensHorsAss - interets);
    const crdFin = crdAtYearEnd(loan, a);
    rows.push([`A${a}`, eur(mensAnnee), eur(interets), eur(capitalRembAnnee), eur(crdFin)]);
  }
  const totalMens = rows.reduce((s, r) => s + parseNum(r[1]), 0);
  const totalInt = rows.reduce((s, r) => s + parseNum(r[2]), 0);
  const totalCap = rows.reduce((s, r) => s + parseNum(r[3]), 0);
  rows.push(["TOTAL", eur(totalMens), eur(totalInt), eur(totalCap), "—"]);
  return rows;
}
function parseNum(s: string): number {
  return parseFloat(s.replace(/[^\d.,\-]/g, "").replace(",", ".")) || 0;
}

function computeAnnualCharges(expenses: Depense[]): number {
  return expenses
    .filter((e) => !EXCLUDED_EXPENSE_CATS.has(e.categorie))
    .reduce((sum, e) => sum + annualiserMontant(getCurrentMontant(e), e.frequence), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
type ReportMode = "demande_pret" | "suivi_interne" | "refinancement";
const MODE_CONFIG: Record<ReportMode, {
  coverTitle: string;
  coverSubtitle: string;
  dossierShort: string;
  context: string;
}> = {
  demande_pret: {
    coverTitle: "DOSSIER DE DEMANDE DE FINANCEMENT",
    coverSubtitle: "Présentation du projet d'investissement locatif",
    dossierShort: "Demande de prêt",
    context: "Ce dossier synthétise les caractéristiques du projet d'investissement locatif et les projections financières associées. Il a pour objet d'appuyer une demande de financement bancaire.",
  },
  suivi_interne: {
    coverTitle: "FICHE DE SUIVI PATRIMONIAL",
    coverSubtitle: "État du bien et performance à date",
    dossierShort: "Suivi interne",
    context: "Cette fiche présente l'état du bien, l'exploitation en cours et les projections associées. Document interne de suivi patrimonial.",
  },
  refinancement: {
    coverTitle: "DOSSIER DE REFINANCEMENT",
    coverSubtitle: "Demande de renégociation du crédit en cours",
    dossierShort: "Refinancement",
    context: "Ce dossier présente l'état d'exploitation actuel du bien, la performance observée depuis l'acquisition et les conditions du crédit en cours, en vue d'une renégociation.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPropertyReport(params: {
  property: Bien;
  lots: Lot[];
  expenses: Depense[];
  incomes: Revenu[];
  loan: Pret | null;
  interventions: Intervention[];
  montantEmprunteEffectif: number;
  breakEvenMarge: number | null;
  mode: ReportMode;
}): Promise<void> {
  const { property, lots, expenses, incomes, loan, interventions, montantEmprunteEffectif, breakEvenMarge, mode } = params;
  const cfg = MODE_CONFIG[mode];

  const { default: JsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica");

  // ── Derived figures ──
  const loyerMensuelCible = lots.reduce((s, l) => s + (l.loyerMensuel ?? 0), 0);
  const vacanceGlobale = property.tauxVacanceGlobal ?? 0;
  const loyerMensuelAvecVac = lots.reduce((s, l) => {
    const vac = property.tauxVacanceGlobal != null ? property.tauxVacanceGlobal : (l.tauxVacance ?? 0);
    return s + (l.loyerMensuel ?? 0) * (1 - vac);
  }, 0);
  const loyerAnnuelCible = loyerMensuelCible * 12;
  const loyerAnnuelAvecVac = loyerMensuelAvecVac * 12;
  const chargesAnnuelles = computeAnnualCharges(expenses);
  const mensualiteMens = loan ? mensualiteAmortissement(loan) + loan.assuranceAnnuelle / 12 : 0;
  const mensualiteAnnuelle = mensualiteMens * 12;
  const coutTotal = coutTotalBien(property);
  const apport = property.apport ?? Math.max(0, coutTotal - (loan?.montantEmprunte ?? 0));
  const rendementBrut = coutTotal > 0 ? loyerAnnuelCible / coutTotal : 0;
  const rendementNet = coutTotal > 0 ? (loyerAnnuelAvecVac - chargesAnnuelles) / coutTotal : 0;
  const capitalUtilise = Math.max(0, coutTotal - loyerAnnuelAvecVac); // pour suivi
  void capitalUtilise;
  const cfMensuel = (loyerAnnuelAvecVac - chargesAnnuelles) / 12 - mensualiteMens;
  const cfAnnuel = cfMensuel * 12;

  // Pour la KPI "Patrimoine net A10" sur la page Le bien.
  const valeurBien = property.prixAchat + (property.montantTravaux ?? 0) + (property.montantMobilier ?? 0);
  // Part du loyer consommée par le crédit (mensualité / loyer mensuel).
  // Affichée dans les "Indicateurs de performance" de la page Exploitation.
  const partLoyerCredit = loyerMensuelAvecVac > 0 ? mensualiteMens / loyerMensuelAvecVac : 0;

  const today = new Date().toLocaleDateString("fr-FR");

  // Regime fiscal vient de la simulation associee (s'il y en a une).
  let regimeFiscal: string | null = null;
  if (property.simulationId) {
    try {
      const { loadSimulations, hydrateSimulation } = await import("./simulations");
      const sims = loadSimulations();
      const sim = sims.find((s) => s.id === property.simulationId);
      if (sim) {
        const hydrated = await hydrateSimulation(sim);
        regimeFiscal = hydrated.regimeFiscal ?? null;
      }
    } catch {
      // Ignore — la sim est optionnelle pour le PDF.
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════
  renderCover(doc, property, cfg, today);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — LE BIEN (avec KPIs chiffres clés en tête)
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader(doc, property.nom || "—", cfg.dossierShort, 2, 99);
  let y = 22;
  y = sectionTitle(doc, y, "Le bien");

  // 4 KPI boxes — vue d'ensemble en tête de page
  const kpiW = (CW - 3 * 4) / 4;
  const kpiH = 20;
  const crdA10 = loan ? crdAtYearEnd(loan, 10) : 0;
  const valeurA10 = valeurBien * Math.pow(1.02, 10); // +2%/an par défaut
  const patrimoineA10 = valeurA10 - crdA10;
  kpiBox(doc, M + 0 * (kpiW + 4), y, kpiW, kpiH, "Coût total", eur(coutTotal));
  kpiBox(doc, M + 1 * (kpiW + 4), y, kpiW, kpiH, "Cash flow mensuel", eur(cfMensuel), { color: cfMensuel >= 0 ? C.green : C.red });
  kpiBox(doc, M + 2 * (kpiW + 4), y, kpiW, kpiH, "Rendement net", pct(rendementNet * 100));
  kpiBox(doc, M + 3 * (kpiW + 4), y, kpiW, kpiH, "Patrimoine net A10", eur(patrimoineA10));
  y += kpiH + 3;
  y = footnote(doc, y, "Patrimoine net A10 : valeur du bien à 10 ans (hypothèse +2 %/an) moins le capital restant dû.", M, CW);
  y += 4;

  const charL = M;
  const charR = M + CW / 2 + 4;
  const charW = (CW - 8) / 2;
  let yL = y, yR = y;
  yL = subsectionTitle(doc, yL, "Caractéristiques", charL);
  yL = kvRow(doc, yL, "Type", TYPE_BIEN_LABELS[property.type] ?? property.type, { x: charL, w: charW });
  if (property.ville) yL = kvRow(doc, yL, "Ville", property.ville, { x: charL, w: charW });
  if (property.surfaceM2) yL = kvRow(doc, yL, "Surface", `${property.surfaceM2} m²`, { x: charL, w: charW });
  if (property.surfaceM2 && property.prixAchat) yL = kvRow(doc, yL, "Prix au m²", eur(Math.round(property.prixAchat / property.surfaceM2)) + "/m²", { x: charL, w: charW });
  if (property.anneeConstruction) yL = kvRow(doc, yL, "Année de construction", String(property.anneeConstruction), { x: charL, w: charW });
  if (property.dpe) {
    const dpeLabel = property.dpe === "VIERGE" ? "Non réalisé" : property.dpe;
    const dpeColor: readonly [number, number, number] | undefined =
      property.dpe === "F" || property.dpe === "G" ? C.red :
      property.dpe === "E" ? C.amber :
      property.dpe === "A" || property.dpe === "B" ? C.green : undefined;
    yL = kvRow(doc, yL, "DPE", dpeLabel, { x: charL, w: charW, color: dpeColor });
  }
  yL = kvRow(doc, yL, "Nombre de lots", `${lots.length}`, { x: charL, w: charW });
  if (regimeFiscal) {
    const regimeLabel = regimeFiscal === "IR" ? "SCI à l'IR"
      : regimeFiscal === "IS" ? "SCI à l'IS"
      : regimeFiscal === "LMNP" ? "LMNP"
      : regimeFiscal === "LMP" ? "LMP"
      : regimeFiscal;
    yL = kvRow(doc, yL, "Régime fiscal", regimeLabel, { x: charL, w: charW });
  }
  yL = kvRow(doc, yL, "Statut", property.statut ? STATUT_BIEN_LABELS[property.statut] : "—", { x: charL, w: charW });

  // Jalons : uniquement pour suivi_interne / refinancement. Pour une demande
  // de prêt, le bien n'est pas encore acquis — afficher "Détenu depuis X ans"
  // ou la date d'acte serait contradictoire avec le contexte.
  if (mode !== "demande_pret") {
    yR = subsectionTitle(doc, yR, "Jalons", charR);
    const dateActe = property.statusDates?.acte;
    const dateLocation = property.statusDates?.location;
    if (dateActe) yR = kvRow(doc, yR, "Acte d'acquisition", dateFR(dateActe), { x: charR, w: charW });
    if (dateLocation && dateLocation !== dateActe) yR = kvRow(doc, yR, "Mise en location", dateFR(dateLocation), { x: charR, w: charW });
    if (dateActe) {
      const ans = Math.max(0, (Date.now() - new Date(dateActe).getTime()) / (365.25 * 24 * 3600 * 1000));
      const label = ans < 1 ? `${Math.round(ans * 12)} mois` : `${ans.toFixed(1)} ans`;
      yR = kvRow(doc, yR, "Détenu depuis", label, { x: charR, w: charW });
    }
    if (!dateActe && property.dateSaisie) {
      yR = kvRow(doc, yR, "Saisie au dossier", dateFR(property.dateSaisie), { x: charR, w: charW });
    }
  }

  y = Math.max(yL, yR) + 4;

  // Composition des lots — tableau aéré (label gauche, loyer droite)
  if (lots.length > 0) {
    y = subsectionTitle(doc, y, "Composition");
    const total = lots.reduce((s, l) => s + (l.loyerMensuel ?? 0), 0);
    for (const l of lots) {
      const label = l.nom || "Lot";
      const meta: string[] = [];
      if (l.etage) meta.push(l.etage);
      if (l.surface) meta.push(`${l.surface} m²`);
      const labelFull = meta.length > 0 ? `${label} — ${meta.join(" · ")}` : label;
      y = kvRow(doc, y, labelFull, `${eur(l.loyerMensuel ?? 0)}/mois`);
    }
    hLine(doc, y - 3.5);
    y = kvRow(doc, y, `Total — ${lots.length} lot${lots.length > 1 ? "s" : ""}`, `${eur(total)}/mois`, { bold: true });
    y += 3;
  }

  // Travaux summary if relevant
  const travauxInterventions = interventions.filter((i) => (i.interventionType ?? "intervention") === "travaux");
  if (travauxInterventions.length > 0) {
    y = subsectionTitle(doc, y, "Travaux");
    const termine = travauxInterventions.filter((i) => i.statut === "termine").reduce((s, i) => s + i.montant, 0);
    const enCours = travauxInterventions.filter((i) => i.statut === "en_cours").reduce((s, i) => s + i.montant, 0);
    const planifie = travauxInterventions.filter((i) => i.statut === "planifie").reduce((s, i) => s + i.montant, 0);
    const total = termine + enCours + planifie;
    yL = y;
    yL = kvRow(doc, yL, "Terminés", eur(termine), { x: M, w: CW });
    yL = kvRow(doc, yL, "En cours", eur(enCours), { x: M, w: CW });
    yL = kvRow(doc, yL, "Planifiés", eur(planifie), { x: M, w: CW });
    yL = kvRow(doc, yL, "Total travaux", eur(total), { x: M, w: CW, bold: true });
    y = yL + 2;
  }

  // Notes / commentaire libre (si rempli)
  if (property.notes && property.notes.trim().length > 0) {
    y += 3;
    y = subsectionTitle(doc, y, "Commentaire");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setColor(doc, C.text, "text");
    const noteLines = doc.splitTextToSize(property.notes, CW);
    doc.text(noteLines, M, y);
    y += noteLines.length * 4.5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — PLAN DE FINANCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader(doc, property.nom || "—", cfg.dossierShort, 4, 99);
  y = 22;
  y = sectionTitle(doc, y, "Plan de financement");

  // Ventilation coût
  y = subsectionTitle(doc, y, "Coût total du projet");
  y = kvRow(doc, y, "Prix d'achat", eur(property.prixAchat));
  if (property.fraisNotaire) y = kvRow(doc, y, "Frais de notaire", eur(property.fraisNotaire));
  if (property.fraisAgence) y = kvRow(doc, y, "Frais d'agence", eur(property.fraisAgence));
  if (property.fraisDossier) y = kvRow(doc, y, "Frais de dossier", eur(property.fraisDossier));
  if (property.fraisCourtage) y = kvRow(doc, y, "Frais de courtage", eur(property.fraisCourtage));
  if (property.montantTravaux) y = kvRow(doc, y, "Enveloppe travaux", eur(property.montantTravaux));
  if (property.montantMobilier) y = kvRow(doc, y, "Mobilier", eur(property.montantMobilier));
  hLine(doc, y - 3.5);
  y = kvRow(doc, y, "Coût total", eur(coutTotal), { bold: true });
  y += 2;

  // Financement
  y = subsectionTitle(doc, y, "Sources de financement");
  y = kvRow(doc, y, `Apport personnel (${pct(coutTotal > 0 ? (apport / coutTotal) * 100 : 0, 1)})`, eur(apport));
  if (loan) y = kvRow(doc, y, `Crédit bancaire (${pct(coutTotal > 0 ? (loan.montantEmprunte / coutTotal) * 100 : 0, 1)})`, eur(loan.montantEmprunte));
  hLine(doc, y - 3.5);
  y = kvRow(doc, y, "Total sources", eur(apport + (loan?.montantEmprunte ?? 0)), { bold: true });
  y += 4;

  // Crédit caractéristiques
  if (loan) {
    y = subsectionTitle(doc, y, "Caractéristiques du crédit");
    if (loan.banque) y = kvRow(doc, y, "Établissement", loan.banque);
    y = kvRow(doc, y, "Capital emprunté", eur(loan.montantEmprunte));
    if (montantEmprunteEffectif > 0 && Math.round(montantEmprunteEffectif) !== Math.round(loan.montantEmprunte)) {
      y = kvRow(doc, y, "Capital tiré à date", eur(montantEmprunteEffectif));
    }
    y = kvRow(doc, y, "Taux nominal", pct(loan.tauxAnnuel * 100, 2));
    y = kvRow(doc, y, "Durée", `${loan.dureeAnnees} ans`);
    if ((loan.differeMois ?? 0) > 0) {
      y = kvRow(doc, y, "Différé", `${loan.differeMois} mois (${loan.differeType ?? "partiel"}${loan.differeInclus === false ? ", en plus" : ", inclus"})`);
    }
    y = kvRow(doc, y, "Type de prêt", loan.type === "in_fine" ? "In fine" : "Amortissable");
    if (loan.assuranceAnnuelle) y = kvRow(doc, y, "Assurance prêt", `${eur(loan.assuranceAnnuelle)}/an`);
    y = kvRow(doc, y, "Mensualité totale (hors différé)", `${eur(mensualiteMens)}/mois`, { bold: true });
    y += 2;
    if (breakEvenMarge != null) {
      const color = breakEvenMarge >= 0 ? C.green : C.red;
      const label = breakEvenMarge >= 0 ? "Marge avant cash flow négatif" : "Dépassement du seuil CF négatif";
      y = kvRow(doc, y, label, eur(Math.abs(breakEvenMarge)), { bold: true, color });
      y = footnote(doc, y, "Estimation du montant de principal supplémentaire (ou déjà consommé) qui bascule le cash flow annuel post-différé en négatif.");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — EXPLOITATION
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader(doc, property.nom || "—", cfg.dossierShort, 5, 99);
  y = 22;
  y = sectionTitle(doc, y, "Exploitation");

  // Revenus
  y = subsectionTitle(doc, y, "Revenus locatifs annuels");
  y = kvRow(doc, y, "Loyer brut cible (100% occupation)", eur(loyerAnnuelCible));
  y = kvRow(doc, y, `Vacance locative (${pct(vacanceGlobale * 100, 1)})`, `-${eur(loyerAnnuelCible - loyerAnnuelAvecVac)}`);
  hLine(doc, y - 3.5);
  y = kvRow(doc, y, "Loyer net perçu", eur(loyerAnnuelAvecVac), { bold: true });
  y += 4;

  // Charges
  y = subsectionTitle(doc, y, "Charges d'exploitation annuelles");
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    if (EXCLUDED_EXPENSE_CATS.has(e.categorie)) continue;
    const annuel = annualiserMontant(getCurrentMontant(e), e.frequence);
    if (annuel === 0) continue;
    byCat.set(e.categorie, (byCat.get(e.categorie) ?? 0) + annuel);
  }
  const sortedCat = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  for (const [cat, v] of sortedCat) {
    const label = CATEGORIE_DEPENSE_LABELS[cat as keyof typeof CATEGORIE_DEPENSE_LABELS] ?? cat;
    y = kvRow(doc, y, label, eur(v));
  }
  hLine(doc, y - 3.5);
  y = kvRow(doc, y, "Total charges", eur(chargesAnnuelles), { bold: true });
  y += 4;

  // Cash flow
  y = subsectionTitle(doc, y, "Cash flow");
  y = kvRow(doc, y, "Revenus locatifs nets", eur(loyerAnnuelAvecVac));
  y = kvRow(doc, y, "Charges d'exploitation", `-${eur(chargesAnnuelles)}`);
  if (loan) y = kvRow(doc, y, "Service de la dette", `-${eur(mensualiteAnnuelle)}`);
  hLine(doc, y - 3.5);
  y = kvRow(doc, y, "Cash flow annuel avant impôt", eur(cfAnnuel), { bold: true, color: cfAnnuel >= 0 ? C.green : C.red });
  y = kvRow(doc, y, "Cash flow mensuel équivalent", `${eur(cfMensuel)}/mois`, { color: cfMensuel >= 0 ? C.green : C.red });
  y += 4;

  // Rendements (3 cards)
  y = subsectionTitle(doc, y, "Indicateurs de performance");
  const perfW = (CW - 2 * 4) / 3;
  const perfH = 18;
  kpiBox(doc, M, y, perfW, perfH, "Rdt brut", pct(rendementBrut * 100), { hint: "loyers / coût total" });
  kpiBox(doc, M + perfW + 4, y, perfW, perfH, "Rdt net", pct(rendementNet * 100), { hint: "(loyers nets - charges) / coût total" });
  kpiBox(doc, M + 2 * (perfW + 4), y, perfW, perfH, "Part loyer / crédit", pct(partLoyerCredit * 100, 1), { hint: "mensualité / loyer", color: partLoyerCredit > 0.8 ? C.red : partLoyerCredit > 0.6 ? C.amber : C.green });
  y += perfH + 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNEXES — AMORTISSEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  if (loan) {
    doc.addPage();
    pageHeader(doc, property.nom || "—", cfg.dossierShort, 7, 99);
    y = 22;
    y = sectionTitle(doc, y, "Annexe — Tableau d'amortissement");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, C.muted, "text");
    doc.text(`Capital ${eur(loan.montantEmprunte)}  ·  Taux ${pct(loan.tauxAnnuel * 100, 2)}  ·  Durée ${loan.dureeAnnees} ans${(loan.differeMois ?? 0) > 0 ? `  ·  Différé ${loan.differeMois} mois` : ""}`, M, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Année", "Mensualités", "Intérêts", "Capital remboursé", "CRD fin d'année"]],
      body: buildAmortRows(loan),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, halign: "right", textColor: C.text as unknown as [number, number, number] },
      columnStyles: { 0: { halign: "left" } },
      headStyles: { fillColor: C.navy as unknown as [number, number, number], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [234, 234, 234];
        }
      },
    });

    if (montantEmprunteEffectif > 0 && Math.round(montantEmprunteEffectif) !== Math.round(loan.montantEmprunte)) {
      doc.addPage();
      pageHeader(doc, property.nom || "—", cfg.dossierShort, 8, 99);
      y = 22;
      y = sectionTitle(doc, y, "Annexe — Amortissement sur capital consommé");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor(doc, C.muted, "text");
      doc.text(`Capital tiré ${eur(montantEmprunteEffectif)} (vs ${eur(loan.montantEmprunte)} total)  ·  Taux ${pct(loan.tauxAnnuel * 100, 2)}  ·  Durée ${loan.dureeAnnees} ans`, M, y);
      y += 4;
      y = footnote(doc, y, "Hypothèse : amortissement calculé sur le capital effectivement tiré à ce jour, sans tirage ultérieur de l'enveloppe travaux.", M, CW);
      y += 2;
      const loanEff: Pret = { ...loan, montantEmprunte: montantEmprunteEffectif };
      autoTable(doc, {
        startY: y,
        head: [["Année", "Mensualités", "Intérêts", "Capital remboursé", "CRD fin d'année"]],
        body: buildAmortRows(loanEff),
        theme: "plain",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, halign: "right", textColor: C.text as unknown as [number, number, number] },
        columnStyles: { 0: { halign: "left" } },
        headStyles: { fillColor: C.navy as unknown as [number, number, number], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 8 },
        alternateRowStyles: { fillColor: [247, 247, 247] },
        margin: { left: M, right: M },
        didParseCell: (data) => {
          if (data.row.index === data.table.body.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [234, 234, 234];
          }
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER PASS — page numbers + footer on every page
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Skip footer on cover (page 1)
    if (p > 1) {
      // Rewrite header with correct total pages
      // Need to clear old header first : draw white over it
      setColor(doc, C.white, "fill");
      doc.rect(0, 0, PW, 15, "F");
      pageHeader(doc, property.nom || "—", cfg.dossierShort, p, totalPages);
    }
    pageFooter(doc, today);
  }

  // Unused — kept for future enrichment (autres revenus).
  void incomes;

  const safeName = (property.nom || "bien")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`dossier-${mode}-${safeName}-${dateStr}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────────────────────────────────────
function renderCover(doc: jsPDF, property: Bien, cfg: typeof MODE_CONFIG[ReportMode], today: string) {
  // Full-width navy band top (60mm)
  setColor(doc, C.navy, "fill");
  doc.rect(0, 0, PW, 60, "F");
  // Gold hairline at bottom of band
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.6);
  doc.line(0, 60, PW, 60);
  // Logo placeholder (top-left)
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.3);
  doc.rect(M, 12, 22, 22, "S");
  setColor(doc, C.white, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SCI", M + 11, 26, { align: "center" });
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  setColor(doc, C.goldSoft, "text");
  doc.text("IMMOBILIER", M + 11, 30, { align: "center" });
  // Title (centered)
  setColor(doc, C.white, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(cfg.coverTitle, PW / 2, 30, { align: "center" });
  setColor(doc, C.goldSoft, "text");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(cfg.coverSubtitle, PW / 2, 38, { align: "center" });
  // Date only top-right (no REF — inutile pour l'utilisateur)
  setColor(doc, C.goldSoft, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(today, PW - M, 17, { align: "right" });

  // Bien name (below band)
  setColor(doc, C.navy, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const nameLines = doc.splitTextToSize(property.nom || "Bien immobilier", PW - 2 * M);
  doc.text(nameLines, PW / 2, 80, { align: "center" });

  let coverY = 80 + nameLines.length * 11;

  setColor(doc, C.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (property.adresse) {
    const adresseLines = doc.splitTextToSize(property.adresse, PW - 2 * M);
    doc.text(adresseLines, PW / 2, coverY, { align: "center" });
    coverY += adresseLines.length * 6;
  }
  coverY += 4;
  // Gold accent divider
  setColor(doc, C.gold, "draw");
  doc.setLineWidth(0.5);
  doc.line(PW / 2 - 25, coverY, PW / 2 + 25, coverY);
  coverY += 10;

  // Photo placeholder (centered box, 120×80)
  const photoW = 120, photoH = 80;
  const photoX = (PW - photoW) / 2;
  setColor(doc, [245, 245, 242], "fill");
  doc.rect(photoX, coverY, photoW, photoH, "F");
  setColor(doc, C.border, "draw");
  doc.setLineWidth(0.3);
  doc.rect(photoX, coverY, photoW, photoH, "S");
  setColor(doc, C.light, "text");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("[ photo du bien ]", PW / 2, coverY + photoH / 2 + 2, { align: "center" });
  coverY += photoH + 12;

  // Bien type + surface (statut volontairement omis — non pertinent sur la couverture)
  setColor(doc, C.navy, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const chipParts: string[] = [];
  chipParts.push(TYPE_BIEN_LABELS[property.type] ?? property.type);
  if (property.surfaceM2) chipParts.push(`${property.surfaceM2} m²`);
  doc.text(chipParts.join("  ·  "), PW / 2, coverY, { align: "center" });
  coverY += 8;

  // Footer on cover — edition info
  setColor(doc, C.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Document préparé le ${today}`, PW / 2, PH - 22, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  setColor(doc, C.light, "text");
  doc.text("Document confidentiel — pour usage exclusif du destinataire", PW / 2, PH - 16, { align: "center" });
}

