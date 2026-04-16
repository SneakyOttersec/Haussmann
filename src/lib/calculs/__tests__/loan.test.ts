import { describe, it, expect } from 'vitest';
import {
  calculerMensualiteAmortissable,
  calculerMensualiteInFine,
  calculerMensualite,
  capitalRestantDu,
  interetsAnnuels,
  capitalApresDiffere,
  mensualiteAmortissement,
  mensualitePendantDiffere,
  mensualiteAuMois,
  crdAuMois,
  crdEnFinAnnee,
  interetsAnneePret,
  totalMensualitesAnnee,
  type PretLike,
} from '../pret';

describe('calculerMensualiteAmortissable', () => {
  it('calcule la mensualite standard (200k, 3.5%, 20 ans)', () => {
    const m = calculerMensualiteAmortissable(200_000, 0.035, 20);
    // Attendu ~1159.92 €/mois
    expect(m).toBeCloseTo(1159.92, 0);
  });

  it('retourne capital/nb_mois si taux = 0', () => {
    const m = calculerMensualiteAmortissable(120_000, 0, 10);
    expect(m).toBe(1000);
  });

  it('retourne 0 si capital <= 0', () => {
    expect(calculerMensualiteAmortissable(0, 0.03, 20)).toBe(0);
    expect(calculerMensualiteAmortissable(-100, 0.03, 20)).toBe(0);
  });

  it('retourne 0 si duree <= 0', () => {
    expect(calculerMensualiteAmortissable(100_000, 0.03, 0)).toBe(0);
  });

  it('calcule correctement pour duree courte (1 an)', () => {
    const m = calculerMensualiteAmortissable(12_000, 0.12, 1);
    // ~1066.19 €/mois
    expect(m).toBeGreaterThan(1000);
    expect(m).toBeLessThan(1100);
  });
});

describe('calculerMensualiteInFine', () => {
  it('retourne les interets mensuels seulement', () => {
    const m = calculerMensualiteInFine(200_000, 0.036);
    // 200000 * 0.036 / 12 = 600
    expect(m).toBeCloseTo(600, 2);
  });

  it('retourne 0 si capital <= 0', () => {
    expect(calculerMensualiteInFine(0, 0.03)).toBe(0);
  });
});

describe('calculerMensualite', () => {
  it('dispatche vers amortissable', () => {
    const m = calculerMensualite(200_000, 0.035, 20, 'amortissable');
    expect(m).toBeCloseTo(1159.92, 0);
  });

  it('dispatche vers in_fine', () => {
    const m = calculerMensualite(200_000, 0.036, 20, 'in_fine');
    expect(m).toBeCloseTo(600, 2);
  });
});

describe('capitalRestantDu', () => {
  it('retourne le capital initial en annee 0', () => {
    const crd = capitalRestantDu(200_000, 0.035, 20, 0, 'amortissable');
    expect(crd).toBeCloseTo(200_000, 0);
  });

  it('diminue progressivement', () => {
    const crd1 = capitalRestantDu(200_000, 0.035, 20, 1, 'amortissable');
    const crd10 = capitalRestantDu(200_000, 0.035, 20, 10, 'amortissable');
    const crd19 = capitalRestantDu(200_000, 0.035, 20, 19, 'amortissable');
    expect(crd1).toBeLessThan(200_000);
    expect(crd10).toBeLessThan(crd1);
    expect(crd19).toBeLessThan(crd10);
    expect(crd19).toBeGreaterThan(0);
  });

  it('atteint ~0 en fin de pret', () => {
    const crd = capitalRestantDu(200_000, 0.035, 20, 20, 'amortissable');
    expect(crd).toBeLessThan(1);
  });

  it('in_fine retourne le capital tant que pret pas fini', () => {
    expect(capitalRestantDu(200_000, 0.035, 20, 5, 'in_fine')).toBe(200_000);
    expect(capitalRestantDu(200_000, 0.035, 20, 19, 'in_fine')).toBe(200_000);
    expect(capitalRestantDu(200_000, 0.035, 20, 20, 'in_fine')).toBe(0);
  });

  it('taux 0 — lineaire', () => {
    const crd = capitalRestantDu(120_000, 0, 10, 5, 'amortissable');
    expect(crd).toBeCloseTo(60_000, 0);
  });
});

describe('interetsAnnuels', () => {
  it('sont decroissants en amortissable', () => {
    const i1 = interetsAnnuels(200_000, 0.035, 20, 1, 'amortissable');
    const i10 = interetsAnnuels(200_000, 0.035, 20, 10, 'amortissable');
    const i20 = interetsAnnuels(200_000, 0.035, 20, 20, 'amortissable');
    expect(i1).toBeGreaterThan(i10);
    expect(i10).toBeGreaterThan(i20);
    expect(i20).toBeGreaterThan(0);
  });

  it('annee 1 : interets proches de capital * taux', () => {
    const i1 = interetsAnnuels(200_000, 0.035, 20, 1, 'amortissable');
    // ~6800-7000 (slightly less than 200k * 3.5% = 7000 because capital decreases)
    expect(i1).toBeGreaterThan(6500);
    expect(i1).toBeLessThan(7100);
  });

  it('in_fine : interets constants', () => {
    const i1 = interetsAnnuels(200_000, 0.036, 20, 1, 'in_fine');
    const i10 = interetsAnnuels(200_000, 0.036, 20, 10, 'in_fine');
    expect(i1).toBeCloseTo(7200, 2); // 200000 * 0.036
    expect(i10).toBeCloseTo(7200, 2);
  });
});

// ── Differe (partial / total) ──

const baseLoan: PretLike = {
  montantEmprunte: 200_000,
  tauxAnnuel: 0.036,
  dureeAnnees: 20, // 240 months total
  type: 'amortissable',
};

describe('differe partiel — 12 mois', () => {
  const loan: PretLike = { ...baseLoan, differeMois: 12, differeType: 'partiel' };

  it('capital effectif inchange apres differe partiel', () => {
    expect(capitalApresDiffere(loan)).toBe(200_000);
  });

  it('mensualite pendant le differe = interets seulement', () => {
    // 200_000 * 0.036 / 12 = 600
    expect(mensualitePendantDiffere(loan)).toBeCloseTo(600, 2);
    expect(mensualiteAuMois(loan, 0)).toBeCloseTo(600, 2);
    expect(mensualiteAuMois(loan, 11)).toBeCloseTo(600, 2);
  });

  it('mensualite apres differe est calculee sur 19 ans (228 mois)', () => {
    const m = mensualiteAmortissement(loan);
    // 200_000 sur 228 mois @ 3.6%/an
    const expected = calculerMensualiteAmortissable(200_000, 0.036, 19);
    expect(m).toBeCloseTo(expected, 2);
    expect(mensualiteAuMois(loan, 12)).toBeCloseTo(expected, 2);
  });

  it('CRD constant pendant le differe partiel', () => {
    expect(crdAuMois(loan, 0)).toBe(200_000);
    expect(crdAuMois(loan, 11)).toBe(200_000);
  });

  it('CRD = 0 a la fin de la duree totale', () => {
    expect(crdAuMois(loan, 240 - 1)).toBeCloseTo(0, 0);
    expect(crdEnFinAnnee(loan, 20)).toBeCloseTo(0, 0);
  });

  it('interets de l annee 1 = 12 * (capital * t/12)', () => {
    const i1 = interetsAnneePret(loan, 1);
    expect(i1).toBeCloseTo(7200, 0); // 12 * 600
  });

  it('total mensualites annee 1 = 12 * 600', () => {
    expect(totalMensualitesAnnee(loan, 1)).toBeCloseTo(7200, 0);
  });

  it('total mensualites annee 2 = 12 * mensualite amortissement', () => {
    const m = mensualiteAmortissement(loan);
    expect(totalMensualitesAnnee(loan, 2)).toBeCloseTo(m * 12, 0);
  });
});

describe('differe total — 12 mois', () => {
  const loan: PretLike = { ...baseLoan, differeMois: 12, differeType: 'total' };

  it('capital apres differe = capital * (1+t)^12', () => {
    const expected = 200_000 * Math.pow(1 + 0.036 / 12, 12);
    expect(capitalApresDiffere(loan)).toBeCloseTo(expected, 2);
  });

  it('mensualite pendant le differe = 0', () => {
    expect(mensualitePendantDiffere(loan)).toBe(0);
    expect(mensualiteAuMois(loan, 0)).toBe(0);
    expect(mensualiteAuMois(loan, 11)).toBe(0);
  });

  it('CRD croit pendant le differe total', () => {
    const t = 0.036 / 12;
    expect(crdAuMois(loan, 0)).toBeCloseTo(200_000 * (1 + t), 2);
    expect(crdAuMois(loan, 11)).toBeCloseTo(200_000 * Math.pow(1 + t, 12), 2);
  });

  it('mensualite apres differe sur capital inflate', () => {
    const capital = capitalApresDiffere(loan);
    const m = mensualiteAmortissement(loan);
    const expected = calculerMensualiteAmortissable(capital, 0.036, 19);
    expect(m).toBeCloseTo(expected, 2);
  });

  it('interets payes annee 1 = 0 (capitalises)', () => {
    expect(interetsAnneePret(loan, 1)).toBe(0);
  });

  it('CRD ≈ 0 a la fin', () => {
    expect(crdAuMois(loan, 240 - 1)).toBeCloseTo(0, 0);
  });
});

describe('differe nul (compatibilite)', () => {
  it('comportement identique a un pret sans differe', () => {
    const loanSansDiffere: PretLike = { ...baseLoan, differeMois: 0 };
    const m1 = mensualiteAmortissement(loanSansDiffere);
    const m2 = calculerMensualiteAmortissable(200_000, 0.036, 20);
    expect(m1).toBeCloseTo(m2, 2);
    expect(crdAuMois(loanSansDiffere, 11)).toBeCloseTo(
      capitalRestantDu(200_000, 0.036, 20, 1, 'amortissable'),
      0,
    );
  });
});

describe('differeInclus = false (differe en plus de la duree)', () => {
  // 12 mois differe partiel + 20 ans amort = 252 mois total
  const loanEnPlus: PretLike = {
    ...baseLoan,
    differeMois: 12,
    differeType: 'partiel',
    differeInclus: false,
  };

  // Same config but inclus (existing behavior) = 240 mois total, 228 amort
  const loanInclus: PretLike = {
    ...baseLoan,
    differeMois: 12,
    differeType: 'partiel',
    differeInclus: true,
  };

  it('mensualite amort avec "en plus" est calculee sur 20 ans complets', () => {
    const m = mensualiteAmortissement(loanEnPlus);
    // Pure 20 ans amort on 200k → same as standard 20-year loan
    const expected = calculerMensualiteAmortissable(200_000, 0.036, 20);
    expect(m).toBeCloseTo(expected, 2);
  });

  it('mensualite amort avec "inclus" est calculee sur 19 ans', () => {
    const m = mensualiteAmortissement(loanInclus);
    const expected = calculerMensualiteAmortissable(200_000, 0.036, 19);
    expect(m).toBeCloseTo(expected, 2);
  });

  it('"en plus" a une mensualite amort plus basse que "inclus" (duree amort plus longue)', () => {
    expect(mensualiteAmortissement(loanEnPlus)).toBeLessThan(mensualiteAmortissement(loanInclus));
  });

  it('CRD = 0 a la fin pour "en plus" (mois 251 = dernier mois)', () => {
    expect(crdAuMois(loanEnPlus, 251)).toBe(0);
  });

  it('CRD = 0 a la fin pour "inclus" (mois 239 = dernier mois)', () => {
    expect(crdAuMois(loanInclus, 239)).toBe(0);
  });

  it('interets annee 1 identiques (12 mois de differe partiel)', () => {
    const i1Plus = interetsAnneePret(loanEnPlus, 1);
    const i1Inclus = interetsAnneePret(loanInclus, 1);
    expect(i1Plus).toBeCloseTo(i1Inclus, 0); // both = 12 * 600
  });

  it('interets annee 21 pour "en plus" sont non-nuls (pret tourne encore)', () => {
    // loanEnPlus: 252 mois → annee 21 = mois 240-251
    expect(interetsAnneePret(loanEnPlus, 21)).toBeGreaterThan(0);
  });

  it('interets annee 21 pour "inclus" sont 0 (pret fini a 240 mois)', () => {
    expect(interetsAnneePret(loanInclus, 21)).toBe(0);
  });
});

describe('differe partiel — 6 mois (annee 1 mixte)', () => {
  const loan: PretLike = { ...baseLoan, differeMois: 6, differeType: 'partiel' };
  const t = 0.036 / 12;
  const interetMensuelDiffere = 200_000 * t; // 600

  it('mensualite des 6 premiers mois = interets seulement', () => {
    for (let m = 0; m < 6; m++) {
      expect(mensualiteAuMois(loan, m)).toBeCloseTo(interetMensuelDiffere, 2);
    }
  });

  it('mensualite des 6 mois suivants = amortissement', () => {
    const mAmort = mensualiteAmortissement(loan);
    for (let m = 6; m < 12; m++) {
      expect(mensualiteAuMois(loan, m)).toBeCloseTo(mAmort, 2);
    }
  });

  it('CRD constant pendant les 6 premiers mois', () => {
    for (let m = 0; m < 6; m++) {
      expect(crdAuMois(loan, m)).toBe(200_000);
    }
  });

  it('CRD diminue au mois 6 (debut amortissement)', () => {
    expect(crdAuMois(loan, 6)).toBeLessThan(200_000);
  });

  it('interets annee 1 = 6 mois d interets + 6 mois d interets amort', () => {
    const i1 = interetsAnneePret(loan, 1);
    // First 6 months: 6 * 600 = 3600 (interest only)
    // Next 6 months: some amortization-phase interest (less than 600/m because capital decreases)
    // Total must be > 3600 (the amort phase still has interest) but < 7200 (which would be 12 * 600)
    expect(i1).toBeGreaterThan(3600);
    expect(i1).toBeLessThan(7200);
  });

  it('total mensualites annee 1 = 6 * differe + 6 * amort', () => {
    const total = totalMensualitesAnnee(loan, 1);
    const mAmort = mensualiteAmortissement(loan);
    const expected = 6 * interetMensuelDiffere + 6 * mAmort;
    expect(total).toBeCloseTo(expected, 0);
  });
});

describe('in_fine + differe total — 6 mois', () => {
  const loan: PretLike = {
    montantEmprunte: 200_000,
    tauxAnnuel: 0.036,
    dureeAnnees: 20,
    type: 'in_fine',
    differeMois: 6,
    differeType: 'total',
  };

  it('mensualite = 0 pendant le differe', () => {
    for (let m = 0; m < 6; m++) {
      expect(mensualiteAuMois(loan, m)).toBe(0);
    }
  });

  it('mensualite = interets mensuels apres differe', () => {
    const expected = 200_000 * 0.036 / 12; // 600
    expect(mensualiteAuMois(loan, 6)).toBeCloseTo(expected, 2);
  });

  it('interets annee 1 = 6 mois seulement (pas les 6 mois de differe total)', () => {
    const i1 = interetsAnneePret(loan, 1);
    // 6 months of total defer → 0 interest paid
    // 6 months of in_fine → 6 * 200k * 0.036/12 = 3600
    expect(i1).toBeCloseTo(3600, 0);
  });

  it('interets annee 2 = 12 mois complets', () => {
    const i2 = interetsAnneePret(loan, 2);
    expect(i2).toBeCloseTo(7200, 0);
  });
});
