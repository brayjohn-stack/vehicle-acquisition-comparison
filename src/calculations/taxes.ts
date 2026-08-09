import type { Deal, MethodKey } from '../types/deal';

export const TAX_PRESETS: { key: 'standard' | 'mediumDuty'; label: string; rate: number }[] = [
  { key: 'standard', label: 'Standard', rate: 0.0625 },
  { key: 'mediumDuty', label: 'Medium duty', rate: 0.0725 },
];

/** Which rate applies to a given structure. Cash and finance share a rate; lease can differ. */
export function taxRateFor(deal: Deal, method: MethodKey): number {
  if (deal.tax.useSameRate) return deal.tax.financeCashRate;
  return method === 'lease' ? deal.tax.leaseRate : deal.tax.financeCashRate;
}

export function acquisitionPrice(deal: Deal): number {
  return deal.acquisitionPrice > 0 ? deal.acquisitionPrice : deal.msrp;
}

/**
 * Dealer's vehicle inventory tax. The buyer's orders express this either as a flat
 * amount or as a rate against the sale price (0.1886% and 0.163% appear in the
 * source documents), so both are supported. The rate applies to the full sale
 * price including taxable options, matching the form's subtotal line.
 */
export function inventoryTax(deal: Deal): number {
  const f = deal.fees;
  if (f.inventoryTaxMode !== 'rate') return f.inventoryTax;
  return (acquisitionPrice(deal) + taxableAdditions(deal)) * f.inventoryTaxRate;
}

export function totalFees(deal: Deal): number {
  const f = deal.fees;
  return (
    f.bankFee +
    f.titleLicense +
    f.docFee +
    inventoryTax(deal) +
    f.delivery +
    f.serviceAgreement +
    f.gapInsurance +
    f.facilitatorFee +
    f.other
  );
}

export function capitalizedAdditions(deal: Deal): number {
  return deal.additionalCosts.filter((c) => c.capitalized).reduce((s, c) => s + c.amount, 0);
}

export function nonCapitalizedAdditions(deal: Deal): number {
  return deal.additionalCosts.filter((c) => !c.capitalized).reduce((s, c) => s + c.amount, 0);
}

export function taxableAdditions(deal: Deal): number {
  return deal.additionalCosts.filter((c) => c.taxable).reduce((s, c) => s + c.amount, 0);
}

export interface TaxCalculation {
  rate: number;
  taxableAmount: number;
  tax: number;
  tradeCredit: number;
}

/** Sales/use tax under the operator's stated assumptions. No jurisdiction rules are implied. */
export function computeTax(deal: Deal, method: MethodKey): TaxCalculation {
  const rate = taxRateFor(deal, method);
  const base = acquisitionPrice(deal) + taxableAdditions(deal) + (deal.tax.feesTaxable ? totalFees(deal) : 0);
  const tradeCredit =
    deal.trade.enabled && deal.tax.tradeReducesTaxableAmount ? Math.min(Math.max(deal.trade.value, 0), base) : 0;
  const taxableAmount = Math.max(0, base - tradeCredit);
  return { rate, taxableAmount, tax: taxableAmount * rate, tradeCredit };
}

export interface CostBuildUp {
  acquisitionPrice: number;
  capitalizedAdditions: number;
  nonCapitalizedAdditions: number;
  tax: TaxCalculation;
  fees: number;
  /** Everything that can be capitalized: price + capitalized additions + tax + transaction costs. */
  grossAmount: number;
  /** Total project cost regardless of how it is capitalized. */
  totalProjectCost: number;
}

export function buildCosts(deal: Deal, method: MethodKey): CostBuildUp {
  const price = acquisitionPrice(deal);
  const capAdds = capitalizedAdditions(deal);
  const nonCapAdds = nonCapitalizedAdditions(deal);
  const tax = computeTax(deal, method);
  const fees = totalFees(deal);
  const grossAmount = price + capAdds + tax.tax + fees;
  return {
    acquisitionPrice: price,
    capitalizedAdditions: capAdds,
    nonCapitalizedAdditions: nonCapAdds,
    tax,
    fees,
    grossAmount,
    totalProjectCost: grossAmount + nonCapAdds,
  };
}

export interface BuildUpLine {
  label: string;
  amount: number;
  kind: 'item' | 'credit' | 'subtotal' | 'total';
}

/**
 * The cost build-up in buyer's order order of operations, so figures can be tied
 * line by line to the paperwork. `reduction` is the cash applied at signing
 * (down payment or lease capital reduction) for the structure being shown.
 */
export function buildUpLines(deal: Deal, method: MethodKey, reduction: number): BuildUpLine[] {
  const costs = buildCosts(deal, method);
  const f = deal.fees;
  const lines: BuildUpLine[] = [{ label: 'Sale price', amount: costs.acquisitionPrice, kind: 'item' }];

  for (const cost of deal.additionalCosts) {
    if (cost.amount === 0) continue;
    lines.push({ label: cost.description || 'Additional cost', amount: cost.amount, kind: 'item' });
  }

  if (deal.trade.enabled && deal.trade.value > 0) {
    lines.push({ label: 'Trade-in allowance', amount: -deal.trade.value, kind: 'credit' });
  }

  lines.push({
    label: `Subtotal${deal.tax.tradeReducesTaxableAmount && deal.trade.enabled ? ' (taxable amount)' : ''}`,
    amount: costs.tax.taxableAmount,
    kind: 'subtotal',
  });

  const invTax = inventoryTax(deal);
  if (invTax !== 0) lines.push({ label: "Dealer's vehicle inventory tax", amount: invTax, kind: 'item' });
  lines.push({ label: `Sales tax at ${(costs.tax.rate * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`, amount: costs.tax.tax, kind: 'item' });

  const namedFees: [string, number][] = [
    ['License / registration', f.titleLicense],
    ['Doc fee', f.docFee],
    ['Delivery', f.delivery],
    ['Vehicle service agreement', f.serviceAgreement],
    ['GAP insurance', f.gapInsurance],
    ['Facilitator fee', f.facilitatorFee],
    ['Bank fee', f.bankFee],
    ['Other', f.other],
  ];
  for (const [label, amount] of namedFees) {
    if (amount !== 0) lines.push({ label, amount, kind: 'item' });
  }

  if (deal.trade.enabled && deal.trade.payoff !== 0) {
    lines.push({ label: 'Trade payoff', amount: deal.trade.payoff, kind: 'item' });
  }
  if (reduction !== 0) {
    lines.push({
      label: method === 'lease' ? 'Capital reduction at signing' : 'Down payment',
      amount: -reduction,
      kind: 'credit',
    });
  }

  const total =
    method === 'cash'
      ? costs.totalProjectCost - (deal.trade.enabled ? deal.trade.value - deal.trade.payoff : 0)
      : costs.grossAmount - reduction - (deal.trade.enabled ? deal.trade.value - deal.trade.payoff : 0);

  lines.push({
    label: method === 'cash' ? 'Cash required at acquisition' : method === 'lease' ? 'Capitalized amount' : 'Amount financed',
    amount: Math.max(0, total),
    kind: 'total',
  });

  return lines;
}
