import { describe, expect, it } from 'vitest';
import { computeFinance } from '../src/calculations/finance';
import { computeCash } from '../src/calculations/cash';
import { computeTrade } from '../src/calculations/trade';
import { computeTax, buildCosts } from '../src/calculations/taxes';
import { computeComparison } from '../src/calculations/comparison';
import { createEmptyDeal, createSampleDeal, newCostRow } from '../src/state/deal';
import type { Deal } from '../src/types/deal';

function baseDeal(): Deal {
  const d = createEmptyDeal();
  d.msrp = 70000;
  d.acquisitionPrice = 70000;
  d.estimatedVehicleValue = 20000;
  d.methods = { cash: true, finance: true, lease: true };
  return d;
}

describe('conventional finance', () => {
  it('uses the standard amortizing-loan formula', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.finance = { downPayment: 0, apr: 0.06, termMonths: 60, timing: 'arrears', firstPaymentDays: 30 };
    const r = 0.06 / 12;
    const expected = (70000 * r) / (1 - Math.pow(1 + r, -60));
    expect(computeFinance(d).paymentExact).toBeCloseTo(expected, 6);
  });

  it('amortizes to a scheduled balance of zero at maturity', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.finance = { downPayment: 0, apr: 0.0899, termMonths: 60, timing: 'arrears', firstPaymentDays: 30 };
    const f = computeFinance(d);
    expect(f.payoffAtMonth(60)).toBeCloseTo(0, 2);
    expect(f.amortization.schedule[59].endingBalance).toBeCloseTo(0, 2);
  });

  it('handles 0% APR as principal divided by term', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.finance = { downPayment: 10000, apr: 0, termMonths: 48, timing: 'arrears', firstPaymentDays: 30 };
    const f = computeFinance(d);
    expect(f.amountFinanced).toBeCloseTo(60000, 2);
    expect(f.payment).toBeCloseTo(60000 / 48, 2);
    expect(f.totalInterest).toBeCloseTo(0, 2);
  });

  it('total interest equals total payments less principal', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.finance = { downPayment: 0, apr: 0.0899, termMonths: 60, timing: 'arrears', firstPaymentDays: 30 };
    const f = computeFinance(d);
    expect(f.totalScheduledPayments - f.amountFinanced).toBeCloseTo(f.totalInterest, 1);
  });

  it('leaves a remaining payoff when the comparison occurs before maturity', () => {
    const d = baseDeal();
    d.finance = { downPayment: 0, apr: 0.0899, termMonths: 72, timing: 'arrears', firstPaymentDays: 30 };
    const f = computeFinance(d);
    expect(f.payoffAtMonth(60)).toBeGreaterThan(0);
    expect(f.payoffAtMonth(60)).toBeLessThan(f.amountFinanced);
  });
});

describe('cash acquisition', () => {
  it('requires the full project cost and carries no lien', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0.0625;
    d.fees.titleLicense = 470;
    const c = computeCash(d);
    expect(c.cashRequired).toBeCloseTo(70000 + 4375 + 470, 2);
    expect(c.payoffAtMonth(60)).toBe(0);
  });

  it('treats equity as full vehicle value because no debt exists', () => {
    const d = baseDeal();
    d.methods = { cash: true, finance: false, lease: false };
    const result = computeComparison(d);
    const cash = result.methods[0];
    expect(cash.estimatedEquity).toBeCloseTo(20000, 2);
    expect(cash.payoffAtComparison).toBe(0);
    expect(cash.monthlyPayment).toBeNull();
  });
});

describe('trade-in', () => {
  it('positive equity reduces the amount capitalized and the cash required', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.trade = { enabled: true, value: 36000, payoff: 30000 };
    expect(computeTrade(d).equity).toBeCloseTo(6000, 2);
    expect(computeFinance(d).amountFinanced).toBeCloseTo(64000, 2);
    expect(computeCash(d).cashRequired).toBeCloseTo(64000, 2);
  });

  it('negative equity increases the amount capitalized', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0;
    d.trade = { enabled: true, value: 28000, payoff: 34000 };
    const trade = computeTrade(d);
    expect(trade.equity).toBeCloseTo(-6000, 2);
    expect(trade.isNegative).toBe(true);
    expect(computeFinance(d).amountFinanced).toBeCloseTo(76000, 2);
  });
});

describe('tax assumptions', () => {
  it('applies separate rates to lease and finance when unsynchronized', () => {
    const d = baseDeal();
    d.tax = { ...d.tax, useSameRate: false, financeCashRate: 0.0625, leaseRate: 0.0725 };
    expect(computeTax(d, 'finance').tax).toBeCloseTo(4375, 2);
    expect(computeTax(d, 'lease').tax).toBeCloseTo(5075, 2);
  });

  it('honours the taxable and capitalized flags on additional costs', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0.0625;
    d.additionalCosts = [
      newCostRow({ description: 'Service body', amount: 14500, taxable: true, capitalized: true }),
      newCostRow({ description: 'Prepaid maintenance', amount: 2000, taxable: false, capitalized: false }),
    ];
    const costs = buildCosts(d, 'finance');
    expect(costs.tax.taxableAmount).toBeCloseTo(84500, 2);
    expect(costs.capitalizedAdditions).toBeCloseTo(14500, 2);
    expect(costs.nonCapitalizedAdditions).toBeCloseTo(2000, 2);
    expect(costs.totalProjectCost).toBeCloseTo(costs.grossAmount + 2000, 2);
  });

  it('applies the optional trade tax credit only when enabled', () => {
    const d = baseDeal();
    d.tax.financeCashRate = 0.0625;
    d.trade = { enabled: true, value: 30000, payoff: 0 };
    d.tax.tradeReducesTaxableAmount = false;
    expect(computeTax(d, 'finance').tax).toBeCloseTo(4375, 2);
    d.tax.tradeReducesTaxableAmount = true;
    expect(computeTax(d, 'finance').tax).toBeCloseTo(2500, 2);
  });
});

describe('comparison', () => {
  it('excludes deselected structures entirely', () => {
    const d = baseDeal();
    d.methods = { cash: false, finance: true, lease: false };
    const result = computeComparison(d);
    expect(result.methods.map((m) => m.key)).toEqual(['finance']);
    expect(result.lease).toBeNull();
    expect(result.cash).toBeNull();
  });

  it('subtracts the lease residual from vehicle value when computing equity', () => {
    const d = createSampleDeal();
    d.estimatedVehicleValue = 20000;
    const result = computeComparison(d);
    const lease = result.methods.find((m) => m.key === 'lease')!;
    const finance = result.methods.find((m) => m.key === 'finance')!;
    expect(lease.payoffAtComparison).toBeCloseTo(12025, 2);
    expect(lease.estimatedEquity).toBeCloseTo(7975, 2);
    expect(finance.estimatedEquity).toBeCloseTo(20000, 2);
  });

  it('reports negative equity rather than flooring it at zero', () => {
    const d = createSampleDeal();
    d.estimatedVehicleValue = 10000;
    const lease = computeComparison(d).methods.find((m) => m.key === 'lease')!;
    expect(lease.estimatedEquity).toBeCloseTo(-2025, 2);
    expect(computeComparison(d).takeaways.some((t) => t.includes('negative estimated equity'))).toBe(true);
  });

  it('computes equity net of the remaining loan payoff before maturity', () => {
    const d = createSampleDeal();
    d.finance.termMonths = 72;
    d.comparisonMonthMode = 'custom';
    d.comparisonMonth = 60;
    const finance = computeComparison(d).methods.find((m) => m.key === 'finance')!;
    expect(finance.payoffAtComparison).toBeGreaterThan(0);
    expect(finance.estimatedEquity).toBeCloseTo(20000 - finance.payoffAtComparison, 2);
  });

  it('cumulative cash includes the signing payment for advance-timing leases', () => {
    const d = createSampleDeal();
    const result = computeComparison(d);
    const lease = result.methods.find((m) => m.key === 'lease')!;
    expect(lease.initialCash).toBeCloseTo(1181.64, 2);
    expect(lease.cumulativeCash).toBeCloseTo(1181.64 * 60, 0);
  });

  it('never describes a payment difference as savings', () => {
    const result = computeComparison(createSampleDeal());
    const joined = result.takeaways.join(' ').toLowerCase();
    expect(joined).not.toContain('save');
    expect(joined).not.toContain('better');
    expect(joined).not.toContain('best');
    expect(result.liquidity.monthlyDifference).not.toBeNull();
  });
});
