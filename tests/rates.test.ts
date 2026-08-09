import { describe, expect, it } from 'vitest';
import {
  checkProgram,
  comtracRate,
  maxAdvance,
  maxResidual,
  minDfi,
  maxDfiPercent,
  municipalRate,
  programRate,
  FEDERAL_EXEMPT_ADDER,
} from '../src/rates/ally';
import { projectCycles } from '../src/calculations/cycles';
import { createSampleDeal } from '../src/state/deal';

describe('Ally ComTRAC rate sheet', () => {
  it('reads rates by class, term band and tier', () => {
    expect(comtracRate('new', 60, 'S')).toBeCloseTo(0.0794, 6);
    expect(comtracRate('new', 60, 'C')).toBeCloseTo(0.1444, 6);
    expect(comtracRate('csu', 48, 'A')).toBeCloseTo(0.0979, 6);
    expect(comtracRate('my2024', 72, 'B')).toBeCloseTo(0.1304, 6);
  });

  it('treats 1 and 2 year terms as a single band', () => {
    expect(comtracRate('new', 12, 'A')).toBeCloseTo(comtracRate('new', 24, 'A'), 9);
    expect(comtracRate('new', 24, 'A')).toBeCloseTo(0.0879, 6);
  });

  it('adds the federal exempt loading', () => {
    const base = comtracRate('new', 60, 'S');
    const quoted = programRate({
      kind: 'comtrac',
      tier: 'S',
      vehicleClass: 'new',
      termMonths: 60,
      municipalOutstandings: 0,
      federalExempt: true,
    });
    expect(quoted).toBeCloseTo(base + FEDERAL_EXEMPT_ADDER, 9);
  });

  it('caps residuals by term year and tier', () => {
    expect(maxResidual(60, 'S')).toBeCloseTo(0.25, 6);
    expect(maxResidual(60, 'C')).toBeCloseTo(0.15, 6);
    expect(maxResidual(36, 'A')).toBeCloseTo(0.4, 6);
    expect(maxResidual(72, 'C')).toBeCloseTo(0.05, 6);
  });

  it('splits the advance cap at $80,000 of EDC/AWV', () => {
    expect(maxAdvance(60, 'S', 70000)).toBeCloseTo(1.15, 6);
    expect(maxAdvance(60, 'S', 90000)).toBeCloseTo(1.1, 6);
    expect(maxAdvance(24, 'S', 70000)).toBeCloseTo(1.35, 6);
    expect(maxAdvance(72, 'C', 90000)).toBeCloseTo(0.85, 6);
  });

  it('reads the dealer participation minimums', () => {
    expect(minDfi(260000)).toBe(1250);
    expect(minDfi(80000)).toBe(500);
    expect(minDfi(10000)).toBe(150);
    expect(maxDfiPercent(60)).toBeCloseTo(0.025, 6);
    expect(maxDfiPercent(72)).toBeCloseTo(0.02, 6);
  });
});

describe('municipal lease purchase rates', () => {
  it('reads rates by outstandings band and term', () => {
    expect(municipalRate(25000, 12)).toBeCloseTo(0.0884, 6);
    expect(municipalRate(75000, 60)).toBeCloseTo(0.0834, 6);
    expect(municipalRate(250000, 36)).toBeCloseTo(0.0799, 6);
    expect(municipalRate(750000, 60)).toBeCloseTo(0.0804, 6);
  });

  it('does not apply the federal exempt loading to municipal deals', () => {
    const quoted = programRate({
      kind: 'municipal',
      tier: 'S',
      vehicleClass: 'new',
      termMonths: 60,
      municipalOutstandings: 250000,
      federalExempt: true,
    });
    expect(quoted).toBeCloseTo(0.0809, 6);
  });
});

describe('program limit checks', () => {
  const base = {
    kind: 'comtrac' as const,
    tier: 'A' as const,
    vehicleClass: 'new' as const,
    termMonths: 60,
    residualPercent: 0.2,
    amountAdvanced: 80000,
    edcAwv: 78000,
    directOrEv: false,
    municipalOutstandings: 0,
  };

  it('flags a residual above the tier maximum', () => {
    const errors = checkProgram({ ...base, residualPercent: 0.35 }).filter((c) => c.level === 'error');
    expect(errors.some((e) => e.message.includes('exceeds the tier A maximum of 25%'))).toBe(true);
  });

  it('accepts a residual at the tier maximum', () => {
    expect(checkProgram({ ...base, residualPercent: 0.25 }).filter((c) => c.level === 'error')).toHaveLength(0);
  });

  it('flags an advance above the cap and quantifies the shortfall', () => {
    // Tier A, 5 yr, EDC under $80k caps at 115% — $89,700 on $78,000.
    const errors = checkProgram({ ...base, amountAdvanced: 95000 }).filter((c) => c.level === 'error');
    expect(errors.some((e) => e.message.includes('exceeds the tier A maximum of 115%'))).toBe(true);
  });

  it('enforces the direct ComTRAC and EV floor and term cap', () => {
    const checks = checkProgram({ ...base, directOrEv: true, residualPercent: 0.15, termMonths: 72 });
    expect(checks.some((c) => c.message.includes('minimum 20% residual'))).toBe(true);
    expect(checks.some((c) => c.message.includes('60 month term'))).toBe(true);
  });

  it('flags amounts below the $5,000 minimum', () => {
    const errors = checkProgram({ ...base, amountAdvanced: 4000 }).filter((c) => c.level === 'error');
    expect(errors.some((e) => e.message.includes('$5,000'))).toBe(true);
  });

  it('limits used vehicles to 36 months under the municipal program', () => {
    const errors = checkProgram({ ...base, kind: 'municipal', vehicleClass: 'csu', termMonths: 48 }).filter(
      (c) => c.level === 'error',
    );
    expect(errors.some((e) => e.message.includes('36 months'))).toBe(true);
  });

  it('raises nothing at all in manual mode', () => {
    expect(checkProgram({ ...base, kind: 'manual', residualPercent: 0.9 })).toHaveLength(0);
  });
});

describe('replacement cycle projection', () => {
  it('carries equity from one cycle into the next as a capital reduction', () => {
    const deal = { ...createSampleDeal(), estimatedVehicleValue: 20000, nextVehiclePrice: 60125 };
    const finance = projectCycles(deal, 'finance', 2);
    expect(finance.legs).toHaveLength(2);
    expect(finance.legs[1].equityApplied).toBeCloseTo(20000, 2);
    // A capital reduction in cycle two lowers that cycle's payment.
    expect(finance.legs[1].monthlyPayment!).toBeLessThan(finance.legs[0].monthlyPayment!);
  });

  it('charges a lease shortfall at termination instead of carrying equity forward', () => {
    const deal = { ...createSampleDeal(), estimatedVehicleValue: 8000 };
    const lease = projectCycles(deal, 'lease', 2);
    expect(lease.legs[1].equityApplied).toBeLessThan(0);
    // The shortfall is added to the second cycle's outflow.
    expect(lease.legs[1].cashOutflow).toBeGreaterThan(lease.legs[0].cashOutflow);
  });

  it('reports net cost as total outflow less the equity still held', () => {
    const p = projectCycles(createSampleDeal(), 'finance', 2);
    expect(p.netCost).toBeCloseTo(p.totalCashOutflow - p.finalEquity, 2);
    expect(p.totalMonths).toBe(120);
  });
});
