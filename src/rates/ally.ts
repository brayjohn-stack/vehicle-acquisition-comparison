/**
 * Ally Commercial Services Group — ComTRAC and Municipal Lease Purchase Product.
 * Rate sheet effective August 4, 2026.
 *
 * The sheet is marked "For Dealer Use Only; NOT for Distribution to Consumers",
 * so nothing in this module is rendered in the client presentation. It fills in
 * the operator's assumptions and flags deals that fall outside program limits.
 *
 * Rates change. Everything here is a starting value the operator can override,
 * and the effective date is shown in the UI so a stale sheet is obvious.
 */

export const RATE_SHEET_EFFECTIVE = 'August 4, 2026';

export type AllyTier = 'S' | 'A' | 'B' | 'C';
export type VehicleClass = 'new' | 'csu' | 'my2024';
export type RateProgramKind = 'comtrac' | 'municipal' | 'manual';

export const TIERS: AllyTier[] = ['S', 'A', 'B', 'C'];

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  new: 'New',
  csu: 'Current series used, 2027–2025',
  my2024: '2024 model year',
};

/** Rate sheet rows are banded by year; these map a month term onto the band. */
function rateBand(termMonths: number): 1 | 3 | 4 | 5 | 6 {
  if (termMonths <= 24) return 1; // the sheet's combined "1 & 2 yr" row
  if (termMonths <= 36) return 3;
  if (termMonths <= 48) return 4;
  if (termMonths <= 60) return 5;
  return 6;
}

/** ComTRAC rates by vehicle class, term band, then tier S / A / B / C. */
const COMTRAC_RATES: Record<VehicleClass, Record<number, Record<AllyTier, number>>> = {
  new: {
    1: { S: 7.54, A: 8.79, B: 11.04, C: 14.04 },
    3: { S: 7.54, A: 8.79, B: 11.04, C: 14.04 },
    4: { S: 7.74, A: 8.99, B: 11.24, C: 14.24 },
    5: { S: 7.94, A: 9.19, B: 11.44, C: 14.44 },
    6: { S: 8.14, A: 9.39, B: 11.64, C: 14.64 },
  },
  csu: {
    1: { S: 8.59, A: 9.59, B: 11.84, C: 14.84 },
    3: { S: 8.59, A: 9.59, B: 11.84, C: 14.84 },
    4: { S: 8.79, A: 9.79, B: 12.04, C: 15.04 },
    5: { S: 8.99, A: 9.99, B: 12.24, C: 15.24 },
    6: { S: 9.19, A: 10.19, B: 12.44, C: 15.44 },
  },
  my2024: {
    1: { S: 8.99, A: 9.99, B: 12.24, C: 15.24 },
    3: { S: 8.99, A: 9.99, B: 12.24, C: 15.24 },
    4: { S: 9.39, A: 10.39, B: 12.64, C: 15.64 },
    5: { S: 9.59, A: 10.59, B: 12.84, C: 15.84 },
    6: { S: 9.79, A: 10.79, B: 13.04, C: 16.04 },
  },
};

/** Max residual by full year of term, then tier. */
const MAX_RESIDUAL: Record<number, Record<AllyTier, number>> = {
  1: { S: 0.5, A: 0.5, B: 0.45, C: 0.4 },
  2: { S: 0.45, A: 0.45, B: 0.4, C: 0.35 },
  3: { S: 0.4, A: 0.4, B: 0.35, C: 0.3 },
  4: { S: 0.3, A: 0.3, B: 0.25, C: 0.2 },
  5: { S: 0.25, A: 0.25, B: 0.2, C: 0.15 },
  6: { S: 0.15, A: 0.15, B: 0.1, C: 0.05 },
};

/** Max advance as a share of EDC/AWV, split by whether EDC/AWV reaches $80,000. */
const MAX_ADVANCE: Record<number, Record<AllyTier, [under80k: number, over80k: number]>> = {
  1: { S: [1.35, 1.3], A: [1.25, 1.2], B: [1.2, 1.15], C: [1.1, 1.05] },
  3: { S: [1.3, 1.25], A: [1.2, 1.15], B: [1.15, 1.1], C: [1.05, 1.0] },
  4: { S: [1.3, 1.25], A: [1.2, 1.15], B: [1.15, 1.1], C: [1.05, 1.0] },
  5: { S: [1.15, 1.1], A: [1.15, 1.1], B: [1.1, 1.05], C: [0.95, 0.9] },
  6: { S: [1.1, 1.05], A: [1.1, 1.05], B: [1.05, 1.0], C: [0.9, 0.85] },
};

/** Municipal Lease Purchase rates by outstandings band, then term year 1–5. */
const MUNICIPAL_BANDS: { min: number; max: number; label: string; rates: number[] }[] = [
  { min: 0, max: 49999.99, label: 'Under $50,000', rates: [8.84, 8.89, 8.94, 8.99, 9.04] },
  { min: 50000, max: 99999.99, label: '$50,000 – $99,999', rates: [8.14, 8.19, 8.24, 8.29, 8.34] },
  { min: 100000, max: 499999.99, label: '$100,000 – $499,999', rates: [7.89, 7.94, 7.99, 8.04, 8.09] },
  { min: 500000, max: Infinity, label: '$500,000 and above', rates: [7.84, 7.89, 7.94, 7.99, 8.04] },
];

export const MUNICIPAL_BAND_LABELS = MUNICIPAL_BANDS.map((b) => b.label);

/** Minimum dealer financial interest by amount financed. */
const MIN_DFI: { min: number; dfi: number }[] = [
  { min: 250000, dfi: 1250 },
  { min: 200000, dfi: 1000 },
  { min: 150000, dfi: 750 },
  { min: 75000, dfi: 500 },
  { min: 45000, dfi: 450 },
  { min: 35000, dfi: 350 },
  { min: 25000, dfi: 250 },
  { min: 5000, dfi: 150 },
];

export const FEDERAL_EXEMPT_ADDER = 0.0075;
export const MIN_AMOUNT_FINANCED = 5000;
export const DIRECT_EV_MIN_RESIDUAL = 0.2;
export const DIRECT_EV_MAX_TERM = 60;

/** ComTRAC lease rate as a decimal. */
export function comtracRate(vehicleClass: VehicleClass, termMonths: number, tier: AllyTier): number {
  return COMTRAC_RATES[vehicleClass][rateBand(termMonths)][tier] / 100;
}

/** Municipal Lease Purchase rate as a decimal. */
export function municipalRate(outstandings: number, termMonths: number): number {
  const band = MUNICIPAL_BANDS.find((b) => outstandings >= b.min && outstandings <= b.max) ?? MUNICIPAL_BANDS[0];
  const yearIndex = Math.min(4, Math.max(0, Math.ceil(termMonths / 12) - 1));
  return band.rates[yearIndex] / 100;
}

export function municipalBandLabel(outstandings: number): string {
  return (MUNICIPAL_BANDS.find((b) => outstandings >= b.min && outstandings <= b.max) ?? MUNICIPAL_BANDS[0]).label;
}

export function maxResidual(termMonths: number, tier: AllyTier): number {
  const year = Math.min(6, Math.max(1, Math.ceil(termMonths / 12)));
  return MAX_RESIDUAL[year][tier];
}

export function maxAdvance(termMonths: number, tier: AllyTier, edcAwv: number): number {
  const [under, over] = MAX_ADVANCE[rateBand(termMonths)][tier];
  return edcAwv >= 80000 ? over : under;
}

/** Municipal advance cap: 100% of dealer cost under $80k, 95% at or above. */
export function municipalMaxAdvance(edcAwv: number): number {
  return edcAwv >= 80000 ? 0.95 : 1.0;
}

export function minDfi(amountFinanced: number): number {
  return MIN_DFI.find((r) => amountFinanced >= r.min)?.dfi ?? 0;
}

export function maxDfiPercent(termMonths: number): number {
  return termMonths <= 60 ? 0.025 : 0.02;
}

export interface ProgramCheck {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ProgramInputs {
  kind: RateProgramKind;
  tier: AllyTier;
  vehicleClass: VehicleClass;
  termMonths: number;
  residualPercent: number;
  /** All-in amount being advanced (the capitalized amount). */
  amountAdvanced: number;
  /** Estimated dealer cost / average wholesale value, including upfits. */
  edcAwv: number;
  directOrEv: boolean;
  municipalOutstandings: number;
}

/**
 * Compares the structured deal against program limits. Returns findings rather
 * than silently clamping anything, so the operator sees what needs to change.
 */
export function checkProgram(input: ProgramInputs): ProgramCheck[] {
  const out: ProgramCheck[] = [];
  if (input.kind === 'manual') return out;
  const edc = input.edcAwv > 0 ? input.edcAwv : 0;

  if (input.amountAdvanced > 0 && input.amountAdvanced < MIN_AMOUNT_FINANCED) {
    out.push({ level: 'error', message: `Minimum all-in amount financed is $5,000.` });
  }

  if (input.kind === 'comtrac') {
    const cap = maxResidual(input.termMonths, input.tier);
    if (input.residualPercent > cap + 1e-9) {
      out.push({
        level: 'error',
        message: `Residual of ${(input.residualPercent * 100).toFixed(0)}% exceeds the tier ${input.tier} maximum of ${(cap * 100).toFixed(0)}% at ${input.termMonths} months.`,
      });
    }
    if (input.directOrEv) {
      if (input.residualPercent < DIRECT_EV_MIN_RESIDUAL - 1e-9) {
        out.push({ level: 'error', message: 'Direct ComTRAC and electric vehicles require a minimum 20% residual.' });
      }
      if (input.termMonths > DIRECT_EV_MAX_TERM) {
        out.push({ level: 'error', message: 'Direct ComTRAC and electric vehicles are capped at a 60 month term.' });
      }
    }
    if (edc > 0) {
      const advCap = maxAdvance(input.termMonths, input.tier, edc);
      const advance = input.amountAdvanced / edc;
      if (advance > advCap + 1e-9) {
        const shortfall = input.amountAdvanced - advCap * edc;
        out.push({
          level: 'error',
          message: `Advance of ${(advance * 100).toFixed(0)}% of EDC/AWV exceeds the tier ${input.tier} maximum of ${(advCap * 100).toFixed(0)}%. Roughly ${shortfall.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} would need to come from cash or trade equity.`,
        });
      } else {
        out.push({
          level: 'info',
          message: `Advance is ${(advance * 100).toFixed(0)}% of EDC/AWV against a tier ${input.tier} maximum of ${(advCap * 100).toFixed(0)}%.`,
        });
      }
    }
    const dfi = minDfi(input.amountAdvanced);
    if (dfi > 0) {
      out.push({
        level: 'info',
        message: `Minimum dealer financial interest at this amount financed is ${dfi.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}; maximum DFI is ${(maxDfiPercent(input.termMonths) * 100).toFixed(2)}%.`,
      });
    }
  }

  if (input.kind === 'municipal') {
    if (input.termMonths > 60) {
      out.push({ level: 'error', message: 'Municipal lease terms run to a maximum of 60 months for new vehicles.' });
    }
    if (input.vehicleClass !== 'new' && input.termMonths > 36) {
      out.push({ level: 'error', message: 'Used vehicles are limited to 36 months under the municipal program.' });
    }
    if (edc > 0) {
      const advCap = municipalMaxAdvance(edc);
      const advance = input.amountAdvanced / edc;
      if (advance > advCap + 1e-9) {
        out.push({
          level: 'error',
          message: `Municipal advance is capped at ${(advCap * 100).toFixed(0)}% of dealer cost including upfits. This deal is at ${(advance * 100).toFixed(0)}%.`,
        });
      }
    }
    out.push({
      level: 'info',
      message: 'The entity must qualify under Section 103 of the IRS Code, and current budget and financial statements are required. Rates hold for 90 days from the initial decision.',
    });
  }

  return out;
}

/** Rate the program would quote for the given selections, before any override. */
export function programRate(input: {
  kind: RateProgramKind;
  tier: AllyTier;
  vehicleClass: VehicleClass;
  termMonths: number;
  municipalOutstandings: number;
  federalExempt: boolean;
}): number | null {
  if (input.kind === 'manual') return null;
  const base =
    input.kind === 'municipal'
      ? municipalRate(input.municipalOutstandings, input.termMonths)
      : comtracRate(input.vehicleClass, input.termMonths, input.tier);
  return input.kind === 'comtrac' && input.federalExempt ? base + FEDERAL_EXEMPT_ADDER : base;
}
