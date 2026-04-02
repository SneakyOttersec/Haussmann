import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ExpenseFrequency, IncomeFrequency } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, withCents = false): string {
  return withCents ? currencyFormatterCents.format(value) : currencyFormatter.format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)} %`;
}

export function annualiserMontant(montant: number, frequence: ExpenseFrequency | IncomeFrequency): number {
  switch (frequence) {
    case 'mensuel': return montant * 12;
    case 'trimestriel': return montant * 4;
    case 'annuel': return montant;
    case 'ponctuel': return 0;
  }
}

export function mensualiserMontant(montant: number, frequence: ExpenseFrequency | IncomeFrequency): number {
  switch (frequence) {
    case 'mensuel': return montant;
    case 'trimestriel': return montant / 3;
    case 'annuel': return montant / 12;
    case 'ponctuel': return 0;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}
