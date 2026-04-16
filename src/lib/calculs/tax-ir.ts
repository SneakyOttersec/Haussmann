import { PRELEVEMENTS_SOCIAUX } from '../constants';
import { round2 } from '@/lib/round';

export function calculerImpotIR(
  revenusFonciers: number,
  trancheMarginalePct: number
): number {
  if (revenusFonciers <= 0) return 0;
  const tauxTotal = trancheMarginalePct + PRELEVEMENTS_SOCIAUX;
  return round2(revenusFonciers * tauxTotal);
}
