"use client";

import { useState } from "react";
import type { LoanDetails } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { calculerMensualiteAmortissable, capitalRestantDu } from "@/lib/calculations/loan";

interface LoanAmortizationTableProps {
  loan: LoanDetails;
}

interface AmortRow {
  annee: number;
  crdDebut: number;
  interets: number;
  capital: number;
  assurance: number;
  totalPaye: number;
  crdFin: number;
}

function buildAmortization(loan: LoanDetails): AmortRow[] {
  const rows: AmortRow[] = [];
  const mensualite = loan.type === "in_fine"
    ? loan.montantEmprunte * loan.tauxAnnuel / 12
    : calculerMensualiteAmortissable(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees);

  const assuranceMensuelle = loan.assuranceAnnuelle / 12;

  for (let annee = 1; annee <= loan.dureeAnnees; annee++) {
    const crdDebut = annee === 1
      ? loan.montantEmprunte
      : capitalRestantDu(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees, annee - 1, loan.type);

    const crdFin = capitalRestantDu(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees, annee, loan.type);

    const capitalRembourse = crdDebut - crdFin;
    const totalMensualites = mensualite * 12;
    const interets = totalMensualites - capitalRembourse;
    const assurance = loan.assuranceAnnuelle;
    const totalPaye = totalMensualites + assurance;

    rows.push({
      annee,
      crdDebut,
      interets: Math.max(0, interets),
      capital: capitalRembourse,
      assurance,
      totalPaye,
      crdFin: Math.max(0, crdFin),
    });
  }

  return rows;
}

export function LoanAmortizationTable({ loan }: LoanAmortizationTableProps) {
  const [open, setOpen] = useState(false);
  const rows = buildAmortization(loan);

  const totalInterets = rows.reduce((s, r) => s + r.interets, 0);
  const totalAssurance = rows.reduce((s, r) => s + r.assurance, 0);
  const totalPaye = rows.reduce((s, r) => s + r.totalPaye, 0);
  const coutCredit = totalPaye - loan.montantEmprunte;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-[11px] text-muted-foreground">
          <span>Cout total credit : <strong className="text-foreground">{formatCurrency(coutCredit)}</strong></span>
          <span>dont interets : <strong className="text-foreground">{formatCurrency(totalInterets)}</strong></span>
          <span>dont assurance : <strong className="text-foreground">{formatCurrency(totalAssurance)}</strong></span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-primary hover:underline"
        >
          {open ? "Masquer" : "Tableau d'amortissement"}
        </button>
      </div>

      {open && (
        <div className="mt-3 border border-dotted rounded-md overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-muted-foreground/20">
                <th className="text-left py-2 px-3 font-bold text-muted-foreground">Annee</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">CRD debut</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">Interets</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">Capital</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">Assurance</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">Total paye</th>
                <th className="text-right py-2 px-3 font-bold text-muted-foreground">CRD fin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.annee} className="hover:bg-muted/20 transition-colors">
                  <td className="py-1.5 px-3 font-medium">A{r.annee}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(r.crdDebut)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-destructive">{formatCurrency(r.interets)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(r.capital)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{formatCurrency(r.assurance)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium">{formatCurrency(r.totalPaye)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{formatCurrency(r.crdFin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-dashed border-muted-foreground/20 bg-muted/30 font-bold">
                <td className="py-2 px-3">Total</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(loan.montantEmprunte)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-destructive">{formatCurrency(totalInterets)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(loan.montantEmprunte)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{formatCurrency(totalAssurance)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(totalPaye)}</td>
                <td className="py-2 px-3 text-right tabular-nums">0 EUR</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
