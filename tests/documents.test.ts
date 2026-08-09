import { describe, expect, it } from 'vitest';
import { buildCosts, buildUpLines, computeTax, inventoryTax, totalFees } from '../src/calculations/taxes';
import { computeFinance } from '../src/calculations/finance';
import { balloonPayment, deferralInterest } from '../src/calculations/amortization';
import { createEmptyDeal, newCostRow } from '../src/state/deal';
import type { Deal } from '../src/types/deal';

/** Lease buyer's order: 2026 Hino L6, $87,000 base + $6,900 box, 7.25% tax. */
function leaseBuyersOrder(): Deal {
  const d = createEmptyDeal();
  d.msrp = 93900;
  d.acquisitionPrice = 87000;
  d.additionalCosts = [newCostRow({ description: "28' box and lift gate", amount: 6900, taxable: true, capitalized: true })];
  d.tax = { ...d.tax, useSameRate: true, financeCashRate: 0.0725, leaseRate: 0.0725, preset: 'mediumDuty' };
  d.fees = {
    ...d.fees,
    titleLicense: 245,
    docFee: 225,
    serviceAgreement: 895,
    inventoryTaxMode: 'rate',
    inventoryTaxRate: 0.001886,
  };
  return d;
}

/** Finance buyer's order: 2024 Hino L6 at $73,000, 7.25% tax, $695 bank fee. */
function financeBuyersOrder(): Deal {
  const d = createEmptyDeal();
  d.msrp = 73000;
  d.acquisitionPrice = 73000;
  d.tax = { ...d.tax, useSameRate: true, financeCashRate: 0.0725, leaseRate: 0.0725, preset: 'mediumDuty' };
  d.fees = { ...d.fees, titleLicense: 185.5, docFee: 225, serviceAgreement: 895, bankFee: 695, inventoryTax: 118.99 };
  return d;
}

describe('lease buyer\'s order tie-out', () => {
  it('reproduces the sales tax on the form', () => {
    // Form: sale price 93,900 × 7.25% = 6,807.75
    expect(computeTax(leaseBuyersOrder(), 'lease').tax).toBeCloseTo(6807.75, 2);
  });

  it('computes the vehicle inventory tax as a rate against the full sale price', () => {
    // The form's Loan Calculator uses 0.1886% of the $93,900 sale price, which
    // includes the $6,900 of options, not just the $87,000 base.
    expect(inventoryTax(leaseBuyersOrder())).toBeCloseTo(177.1, 2);
  });

  it('totals license, doc fee and service agreement as on the form', () => {
    const d = leaseBuyersOrder();
    expect(d.fees.titleLicense + d.fees.docFee).toBeCloseTo(470, 2);
    expect(totalFees(d)).toBeCloseTo(245 + 225 + 895 + 93900 * 0.001886, 2);
  });
});

describe('finance buyer\'s order tie-out', () => {
  it('reproduces the sales tax, fees and inventory tax on the form', () => {
    const d = financeBuyersOrder();
    const costs = buildCosts(d, 'finance');
    expect(costs.tax.tax).toBeCloseTo(5292.5, 2);
    expect(d.fees.titleLicense + d.fees.docFee).toBeCloseTo(410.5, 2);
    expect(inventoryTax(d)).toBeCloseTo(118.99, 2);
    // Form balance: 73,000 + 118.99 + 5,292.50 + 410.50 + 895 + 695 = 80,411.99
    expect(costs.grossAmount).toBeCloseTo(80411.99, 2);
  });

  it('produces a build-up that ties line by line to the buyer\'s order', () => {
    const lines = buildUpLines(financeBuyersOrder(), 'finance', 0);
    const total = lines.find((l) => l.kind === 'total')!;
    expect(total.label).toBe('Amount financed');
    expect(total.amount).toBeCloseTo(80411.99, 2);
    expect(lines.find((l) => l.label.startsWith('Sales tax'))!.amount).toBeCloseTo(5292.5, 2);
  });
});

describe('deferred first payment', () => {
  it('capitalizes interest for a 45-day first payment', () => {
    // Buyer's order convention: amount financed × APR / 24 for the extra 15 days.
    expect(deferralInterest(101310.85, 0.019, 45)).toBeCloseTo((101310.85 * 0.019) / 24, 6);
    expect(deferralInterest(101310.85, 0.019, 30)).toBe(0);
  });

  it('reproduces the buyer\'s order "@ 45 days" payment', () => {
    const d = createEmptyDeal();
    d.acquisitionPrice = 101310.85;
    d.tax.financeCashRate = 0;
    d.finance = { downPayment: 0, apr: 0.019, termMonths: 60, timing: 'arrears', firstPaymentDays: 45 };
    // Worksheet: PMT(1.9%/12, 60, 101310.85 + 101310.85*1.9%/24) = 1,772.7259839731
    expect(computeFinance(d).paymentExact).toBeCloseTo(1772.7259839731, 6);
  });
});

describe('TValue schedule tie-out', () => {
  it('reproduces the TValue Online amortization: $154,967.40 at 7.840%, 60 monthly in advance', () => {
    expect(balloonPayment(154967.4, 0.0784, 60, 0, 'advance')).toBeCloseTo(3110.01, 2);
  });

  it('the same schedule in arrears is materially different', () => {
    expect(balloonPayment(154967.4, 0.0784, 60, 0, 'arrears')).toBeCloseTo(3130.33, 2);
  });
});
