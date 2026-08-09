/** Half-up rounding to a fixed number of decimals, guarded against float representation error. */
export function round(value: number, decimals = 2): number {
  if (!isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  // Nudge past representation error (e.g. 1.005 * 100 = 100.49999999999999)
  const corrected = Math.round(parseFloat(scaled.toPrecision(12)));
  return corrected / factor;
}

export const round2 = (v: number) => round(v, 2);

export function num(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return isFinite(n) ? n : 0;
}

export function formatCurrency(value: number, decimals: 0 | 2 = 2): string {
  const v = round(value, decimals);
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${v < 0 ? '-' : ''}$${abs}`;
}

/** Whole dollars for headline figures; cents only when the value is not a round dollar. */
export function formatMoneyCompact(value: number): string {
  return formatCurrency(value, 0);
}

export function formatPercent(decimalRate: number, decimals = 2): string {
  const pct = decimalRate * 100;
  const trimmed = Math.abs(pct - Math.round(pct)) < 1e-9 ? pct.toFixed(0) : pct.toFixed(decimals);
  return `${trimmed}%`;
}
