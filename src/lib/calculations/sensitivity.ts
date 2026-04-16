import type { EntreesCalculateur } from "@/types";
import { calculerRentabilite } from "./index";

export type SensitivityMode = "relative" | "absolute";

export interface SensitivityParam {
  key: string;
  label: string;
  /** Amount by which to vary the parameter */
  variation: number;
  /** "relative" = ±X% of base value; "absolute" = ±X added/subtracted */
  mode: SensitivityMode;
  /** Short description of the variation (e.g. "±10%", "±5 pts") */
  variationLabel: string;
  /** Apply delta to inputs and return modified inputs */
  apply: (inputs: EntreesCalculateur, delta: number) => EntreesCalculateur;
}

/**
 * Parameters submitted to sensitivity analysis.
 * "delta" passed to apply() is the signed variation (negative or positive).
 * For relative mode, we multiply; for absolute, we add.
 */
const PARAMS: SensitivityParam[] = [
  {
    key: "prixAchat",
    label: "Prix d'achat",
    variation: 0.10,
    mode: "relative",
    variationLabel: "±10%",
    apply: (i, d) => ({ ...i, prixAchat: i.prixAchat * (1 + d) }),
  },
  {
    key: "tauxCredit",
    label: "Taux credit",
    variation: 0.20,
    mode: "relative",
    variationLabel: "±20%",
    apply: (i, d) => ({ ...i, tauxCredit: Math.max(0, i.tauxCredit * (1 + d)) }),
  },
  {
    key: "loyer",
    label: "Loyer mensuel",
    variation: 0.10,
    mode: "relative",
    variationLabel: "±10%",
    apply: (i, d) => {
      const factor = 1 + d;
      const newLots = i.lots?.map((l) => ({ ...l, loyerMensuel: l.loyerMensuel * factor })) ?? i.lots;
      return {
        ...i,
        lots: newLots,
        loyerMensuel: i.loyerMensuel * factor,
      };
    },
  },
  {
    key: "tauxVacance",
    label: "Taux de vacance",
    variation: 0.05,
    mode: "absolute",
    variationLabel: "±5 pts",
    apply: (i, d) => ({ ...i, tauxVacance: Math.max(0, Math.min(1, i.tauxVacance + d)) }),
  },
  {
    key: "montantTravaux",
    label: "Montant travaux",
    variation: 0.20,
    mode: "relative",
    variationLabel: "±20%",
    apply: (i, d) => ({ ...i, montantTravaux: Math.max(0, i.montantTravaux * (1 + d)) }),
  },
  {
    key: "tauxAppreciation",
    label: "Appreciation annuelle",
    variation: 0.01,
    mode: "absolute",
    variationLabel: "±1 pt",
    apply: (i, d) => ({ ...i, tauxAppreciation: Math.max(0, i.tauxAppreciation + d) }),
  },
  {
    key: "charges",
    label: "Charges totales",
    variation: 0.20,
    mode: "relative",
    variationLabel: "±20%",
    apply: (i, d) => {
      const f = 1 + d;
      return {
        ...i,
        chargesCopro: i.chargesCopro * f,
        taxeFonciere: i.taxeFonciere * f,
        assurancePNO: i.assurancePNO * f,
        comptabilite: i.comptabilite * f,
        cfeCrl: i.cfeCrl * f,
        entretien: i.entretien * f,
        gli: i.gli * f,
        autresChargesAnnuelles: i.autresChargesAnnuelles * f,
      };
    },
  },
];

export interface SensitivityResult {
  key: string;
  label: string;
  variationLabel: string;
  triBase: number;
  triLow: number;    // TRI with unfavorable variation
  triHigh: number;   // TRI with favorable variation
  deltaLow: number;  // triLow - triBase (typically negative)
  deltaHigh: number; // triHigh - triBase (typically positive)
  /** Absolute impact range used for sorting (max - min) */
  spread: number;
}

/**
 * Run sensitivity analysis on the calculator inputs.
 * Returns one result per parameter, sorted by spread descending.
 */
export function computeSensitivity(inputs: EntreesCalculateur): SensitivityResult[] {
  const baseResults = calculerRentabilite(inputs);
  const triBase = baseResults.tri;

  const results: SensitivityResult[] = PARAMS.map((p) => {
    const delta = p.variation;
    const resLow = calculerRentabilite(p.apply(inputs, -delta));
    const resHigh = calculerRentabilite(p.apply(inputs, +delta));

    // deltaLow/deltaHigh represent the impact of the -/+ variation on the TRI.
    // For some params (loyer, appreciation), -X% is bad; for others (prix, taux, vacance, travaux, charges), -X% is good.
    // We keep the raw deltas: deltaLow = tri(-δ) - base, deltaHigh = tri(+δ) - base.
    // The chart determines color using sign.
    return {
      key: p.key,
      label: p.label,
      variationLabel: p.variationLabel,
      triBase,
      triLow: resLow.tri,
      triHigh: resHigh.tri,
      deltaLow: resLow.tri - triBase,
      deltaHigh: resHigh.tri - triBase,
      spread: Math.abs(resHigh.tri - resLow.tri),
    };
  });

  results.sort((a, b) => b.spread - a.spread);
  return results;
}
