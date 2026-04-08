/** Round to 2 decimal places (EUR amounts) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to 4 decimal places (rates, percentages) */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
