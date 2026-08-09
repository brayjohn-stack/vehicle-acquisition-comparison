import { describe, expect, it } from 'vitest';
import { balloonPayment, buildSchedule } from '../src/calculations/amortization';
import { computeLease } from '../src/calculations/lease';
import { createEmptyDeal } from '../src/state/deal';
import type { Deal } from '../src/types/deal';

const GROSS = 65047.8125;
const APR = 0.0899;

/** Workbook base deal: $60,125 vehicle, 6.25% tax, $695 bank fee, $470 title/license. */
function workbookDeal(termMonths: number, residualPercent: number): Deal {
  const base = createEmptyDeal();
  return {
    ...base,
    msrp: 60125,
    acquisitionPrice: 60125,
    fees: { ...base.fees, bankFee: 695, titleLicense: 470 },
    tax: { ...base.tax, useSameRate: true, financeCashRate: 0.0625, leaseRate: 0.0625 },
    lease: { ...base.lease, apr: APR, termMonths, timing: 'advance', residualPercent },
  };
}

describe('workbook validation cases (payments in advance)', () => {
  const cases = [
    { name: 'Case A — 36 months, 40% residual', term: 36, pct: 0.4, residual: 24050, payment: 1472.67 },
    { name: 'Case B — 48 months, 30% residual', term: 48, pct: 0.3, residual: 18037.5, payment: 1295.06 },
    { name: 'Case C — 60 months, 20% residual', term: 60, pct: 0.2, residual: 12025, payment: 1181.64 },
    { name: 'Case D — 60 months, 25% residual', term: 60, pct: 0.25, residual: 15031.25, payment: 1142.07 },
    { name: 'Case E — 48 months, 20% residual', term: 48, pct: 0.2, residual: 12025, payment: 1398.83 },
  ];

  for (const c of cases) {
    it(`${c.name} reproduces the workbook payment`, () => {
      const result = computeLease(workbookDeal(c.term, c.pct));
      expect(result.costs.grossAmount).toBeCloseTo(GROSS, 4);
      expect(result.capitalizedAmount).toBeCloseTo(GROSS, 4);
      expect(result.residualAmount).toBeCloseTo(c.residual, 2);
      expect(result.payment).toBeCloseTo(c.payment, 2);
      expect(result.paymentExact).toBeCloseTo(c.payment, 2);
    });
  }
});

describe('lease mechanics', () => {
  it('tax, fees and gross amount match the workbook build-up', () => {
    const result = computeLease(workbookDeal(60, 0.2));
    expect(result.costs.tax.tax).toBeCloseTo(3757.8125, 4);
    expect(result.costs.fees).toBeCloseTo(1165, 2);
    expect(result.costs.grossAmount).toBeCloseTo(65047.8125, 4);
  });

  it('amortizes to the residual, not to zero', () => {
    const result = computeLease(workbookDeal(60, 0.2));
    expect(result.scheduledEndingBalance).toBeCloseTo(12025, 2);
    expect(result.payoffAtMonth(60)).toBeCloseTo(12025, 2);
    expect(result.amountAmortized).toBeCloseTo(65047.81 - 12025, 1);
  });

  it('the residual does not disappear past maturity', () => {
    const result = computeLease(workbookDeal(60, 0.2));
    expect(result.payoffAtMonth(72)).toBeCloseTo(12025, 2);
  });

  it('remaining payoff before maturity sits above the residual', () => {
    const result = computeLease(workbookDeal(60, 0.2));
    const mid = result.payoffAtMonth(30);
    expect(mid).toBeGreaterThan(12025);
    expect(mid).toBeLessThan(result.capitalizedAmount);
  });

  it('arrears payments exceed advance payments on identical terms', () => {
    const advance = computeLease(workbookDeal(60, 0.2));
    const arrearsDeal = workbookDeal(60, 0.2);
    arrearsDeal.lease.timing = 'arrears';
    const arrears = computeLease(arrearsDeal);
    expect(arrears.payment).toBeGreaterThan(advance.payment);
    expect(arrears.paymentExact / (1 + APR / 12)).toBeCloseTo(advance.paymentExact, 8);
  });

  it('handles 0% APR as straight-line amortization to the residual', () => {
    const deal = workbookDeal(60, 0.2);
    deal.lease.apr = 0;
    const result = computeLease(deal);
    expect(result.payment).toBeCloseTo((65047.8125 - 12025) / 60, 2);
    expect(result.totalInterest).toBeCloseTo(0, 2);
  });

  it('supports a residual entered as a dollar amount', () => {
    const deal = workbookDeal(60, 0.2);
    deal.lease.residualMode = 'amount';
    deal.lease.residualAmount = 15031.25;
    const result = computeLease(deal);
    expect(result.residualAmount).toBeCloseTo(15031.25, 2);
    expect(result.payment).toBeCloseTo(1142.07, 2);
  });

  it('residual basis defaults to the acquisition price, not the gross capitalized amount', () => {
    const result = computeLease(workbookDeal(60, 0.2));
    expect(result.residualBasis).toBeCloseTo(60125, 2);
    const deal = workbookDeal(60, 0.2);
    deal.lease.residualBasis = 'capitalizedAmount';
    expect(computeLease(deal).residualAmount).toBeCloseTo(65047.8125 * 0.2, 2);
  });

  it('schedule reconciles to the residual without penny drift', () => {
    const result = buildSchedule(GROSS, APR, 60, 12025, 'advance');
    const last = result.schedule[result.schedule.length - 1];
    expect(last.endingBalance).toBeCloseTo(12025, 2);
    // The final payment absorbs the cents-rounding of the level payment.
    expect(Math.abs(last.payment - result.payment)).toBeLessThan(1);
  });

  it('balloonPayment matches the direct closed form', () => {
    const r = APR / 12;
    const g = Math.pow(1 + r, 60);
    const arrears = ((GROSS * g - 12025) * r) / (g - 1);
    expect(balloonPayment(GROSS, APR, 60, 12025, 'advance')).toBeCloseTo(arrears / (1 + r), 8);
  });
});
