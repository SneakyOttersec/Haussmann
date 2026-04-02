export function calculerTRI(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0;

  let rate = 0.1;
  for (let iter = 0; iter < 1000; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const denom = Math.pow(1 + rate, i);
      npv += cashFlows[i] / denom;
      if (i > 0) dnpv -= (i * cashFlows[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-8) return newRate * 100;
    rate = newRate;
    if (rate < -0.99) return -99;
    if (rate > 10) return 1000;
  }
  return rate * 100;
}
