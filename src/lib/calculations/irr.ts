function npv(cashFlows: number[], rate: number): number {
  let total = 0;
  for (let i = 0; i < cashFlows.length; i++) {
    total += cashFlows[i] / Math.pow(1 + rate, i);
  }
  return total;
}

export function calculerTRI(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0;

  // Check if there is at least one sign change (necessary for a valid IRR)
  const hasNeg = cashFlows.some(cf => cf < 0);
  const hasPos = cashFlows.some(cf => cf > 0);
  if (!hasNeg || !hasPos) return 0;

  // Newton-Raphson method
  let rate = 0.08;
  for (let iter = 0; iter < 200; iter++) {
    let npvVal = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const denom = Math.pow(1 + rate, i);
      npvVal += cashFlows[i] / denom;
      if (i > 0) dnpv -= (i * cashFlows[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npvVal / dnpv;
    if (Math.abs(newRate - rate) < 1e-8) return newRate * 100;
    // Guard against divergence
    if (newRate < -0.99 || newRate > 5 || isNaN(newRate)) break;
    rate = newRate;
  }

  // Fallback: bisection method (more robust)
  let lo = -0.5;
  let hi = 2.0;

  // Find a valid bracket
  if (npv(cashFlows, lo) * npv(cashFlows, hi) > 0) {
    // No sign change — try wider range
    lo = -0.9;
    hi = 10;
    if (npv(cashFlows, lo) * npv(cashFlows, hi) > 0) {
      return rate * 100; // Return Newton-Raphson estimate
    }
  }

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(cashFlows, mid);
    if (Math.abs(npvMid) < 0.01 || (hi - lo) < 1e-8) {
      return mid * 100;
    }
    if (npv(cashFlows, lo) * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return ((lo + hi) / 2) * 100;
}
