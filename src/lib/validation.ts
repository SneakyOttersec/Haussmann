import { z } from 'zod';

// --- Helpers ---

const positiveAmount = z.number().min(0.01, 'Montant requis (> 0)');
const nonNegativeAmount = z.number().min(0, 'Montant >= 0');
const percentage01 = z.number().min(0, 'Min 0%').max(1, 'Max 100%');
const interestRate = z.number().min(0, 'Min 0%').max(0.15, 'Max 15%');
const notFutureDate = z.string().refine(
  (d) => !d || new Date(d) <= new Date(),
  'La date ne peut pas etre dans le futur',
);

// --- Property ---

export const propertySchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100, 'Max 100 caracteres'),
  adresse: z.string().min(1, 'Adresse requise').max(200, 'Max 200 caracteres'),
  type: z.enum(['appartement', 'maison', 'immeuble', 'local_commercial', 'parking']),
  prixAchat: positiveAmount,
  dateSaisie: notFutureDate,
  fraisNotaire: nonNegativeAmount,
  fraisAgence: nonNegativeAmount,
  fraisDossier: nonNegativeAmount,
  fraisCourtage: nonNegativeAmount,
  montantTravaux: nonNegativeAmount,
  montantMobilier: nonNegativeAmount,
  surfaceM2: z.number().min(0).optional(),
  notes: z.string().max(2000, 'Max 2000 caracteres').optional(),
});

// --- Expense ---

export const expenseSchema = z.object({
  categorie: z.string().min(1),
  label: z.string().max(200, 'Max 200 caracteres').optional(),
  montant: positiveAmount,
  frequence: z.enum(['mensuel', 'trimestriel', 'annuel', 'ponctuel']),
  dateDebut: z.string().min(1, 'Date requise'),
  dateFin: z.string().optional(),
}).refine(
  (d) => !d.dateFin || d.dateFin >= d.dateDebut,
  { message: 'Date fin doit etre apres date debut', path: ['dateFin'] },
);

// --- Income ---

export const incomeSchema = z.object({
  categorie: z.string().min(1),
  label: z.string().max(200, 'Max 200 caracteres').optional(),
  montant: positiveAmount,
  frequence: z.enum(['mensuel', 'trimestriel', 'annuel', 'ponctuel']),
  dateDebut: z.string().min(1, 'Date requise'),
  dateFin: z.string().optional(),
}).refine(
  (d) => !d.dateFin || d.dateFin >= d.dateDebut,
  { message: 'Date fin doit etre apres date debut', path: ['dateFin'] },
);

// --- Loan ---

export const loanSchema = z.object({
  type: z.enum(['amortissable', 'in_fine']),
  montantEmprunte: positiveAmount,
  tauxAnnuel: interestRate,
  dureeAnnees: z.number().int().min(1, 'Min 1 an').max(30, 'Max 30 ans'),
  dateDebut: z.string().min(1, 'Date requise'),
  assuranceAnnuelle: nonNegativeAmount,
  differeMois: z.number().int().min(0, 'Min 0 mois').max(60, 'Max 60 mois').optional(),
  differeType: z.enum(['partiel', 'total']).optional(),
  differeInclus: z.boolean().optional(),
}).refine(
  // When differe is included in the duration, it must be shorter than the total.
  // When differe is added on top, no constraint — the amortization phase is the full dureeAnnees.
  (data) => !data.differeMois || data.differeInclus === false || data.differeMois < data.dureeAnnees * 12,
  { message: 'Le differe doit etre strictement inferieur a la duree totale (ou choisir "En plus de la duree")', path: ['differeMois'] },
);

// --- Calculator Inputs (partial, key fields) ---

export const calculatorInputsSchema = z.object({
  nomSimulation: z.string().min(1, 'Nom requis'),
  prixAchat: positiveAmount,
  fraisNotairePct: percentage01,
  fraisAgence: nonNegativeAmount,
  surfaceM2: nonNegativeAmount,
  montantTravaux: nonNegativeAmount,
  tauxVacance: percentage01,
  montantEmprunte: nonNegativeAmount,
  apportPersonnel: nonNegativeAmount,
  tauxCredit: interestRate,
  dureeCredit: z.number().int().min(1, 'Min 1 an').max(30, 'Max 30 ans'),
  chargesCopro: nonNegativeAmount,
  taxeFonciere: nonNegativeAmount,
  assurancePNO: nonNegativeAmount,
  gestionLocativePct: percentage01,
  tauxAppreciation: z.number().min(-0.1, 'Min -10%').max(0.2, 'Max 20%'),
  dureeDetention: z.number().int().min(1, 'Min 1 an').max(50, 'Max 50 ans'),
});

// --- Generic validation helper ---

export type ValidationErrors = Record<string, string>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationErrors;
}

export function validateForm<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: {} };
  }
  const errors: ValidationErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}
