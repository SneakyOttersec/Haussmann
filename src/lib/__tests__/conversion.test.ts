import { describe, expect, it } from 'vitest';
import type { DonneesApp, EntreesCalculateur } from '@/types';
import { DEFAULT_CALCULATOR_INPUTS } from '../constants';
import { simulationToBien } from '../simulationToBien';
import { bienToSimulation } from '../bienToSimulation';

function createEmptyData(): DonneesApp {
  return {
    biens: [],
    revenus: [],
    depenses: [],
    prets: [],
    lots: [],
    interventions: [],
    contacts: [],
    documents: [],
    suiviLoyers: [],
    paiementsCharges: [],
    settings: {
      regimeFiscal: 'IR',
      nomSCI: 'SCI Test',
      associes: [],
    },
  };
}

describe('simulationToBien / bienToSimulation', () => {
  it('preserve la gestion locative en multi-lots', () => {
    const inputs: EntreesCalculateur = {
      ...DEFAULT_CALCULATOR_INPUTS,
      lots: [
        { id: '1', nom: 'Lot 1', loyerMensuel: 700 },
        { id: '2', nom: 'Lot 2', loyerMensuel: 500 },
      ],
      loyerMensuel: 1200,
      tauxVacance: 0.08,
      gestionLocativePct: 0.07,
      montantEmprunte: 150_000,
      fraisGarantie: 2_500,
      montantMobilierTotal: 9_000,
      differePretMois: 6,
      differePretInclus: false,
    };

    let data = createEmptyData();
    const setData = (updater: (prev: DonneesApp) => DonneesApp) => {
      data = updater(data);
    };

    const bienId = simulationToBien(inputs, setData, 'sim-1');
    const roundtrip = bienToSimulation(data, bienId);

    expect(roundtrip).not.toBeNull();
    expect(roundtrip!.gestionLocativePct).toBeCloseTo(inputs.gestionLocativePct, 3);
    expect(roundtrip!.apportPersonnel).toBeCloseTo(inputs.apportPersonnel, 0);
    expect(roundtrip!.differePretMois).toBe(inputs.differePretMois);
    expect(roundtrip!.differePretInclus).toBe(inputs.differePretInclus);
  });
});
