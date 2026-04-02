import { PRELEVEMENTS_SOCIAUX } from '../constants';

export function calculerImpotIR(
  revenusFonciers: number,
  trancheMarginalePct: number
): number {
  if (revenusFonciers <= 0) return 0;
  const tauxTotal = trancheMarginalePct + PRELEVEMENTS_SOCIAUX;
  return revenusFonciers * tauxTotal;
}
