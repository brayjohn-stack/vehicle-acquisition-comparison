import type { Deal, MethodKey } from '../types/deal';
import { computeCash } from './cash';
import type { CashResult } from './cash';
import { computeFinance } from './finance';
import type { FinanceResult } from './finance';
import { computeLease } from './lease';
import type { LeaseResult } from './lease';
import { computeTrade } from './trade';
import type { TradeResult } from './trade';
import { buildCosts } from './taxes';
import { formatCurrency, formatMoneyCompact, formatPercent, round2 } from './money';

export interface MethodComparison {
  key: MethodKey;
  label: string;
  /** Cash has no financed structure, so several fields stay null rather than being invented. */
  initialCash: number;
  monthlyPayment: number | null;
  termMonths: number | null;
  apr: number | null;
  startingBalance: number | null;
  amountAmortized: number | null;
  scheduledEndingBalance: number | null;
  cumulativeCash: number;
  totalScheduledPayments: number | null;
  totalInterest: number | null;
  payoffAtComparison: number;
  estimatedVehicleValue: number;
  estimatedEquity: number;
  residualPercent: number | null;
  /**
   * Cumulative scheduled cash outflow less estimated equity at the comparison
   * date: what the period cost net of what the client still holds. Ignores the
   * time value of money.
   */
  netCostOfUse: number;
}

export interface ComparisonResult {
  activeMethods: MethodKey[];
  quantity: number;
  comparisonMonth: number;
  estimatedVehicleValue: number;
  totalProjectCost: number;
  /** Cost of the replacement vehicle used on the next-vehicle step. */
  nextVehiclePrice: number;
  trade: TradeResult;
  cash: CashResult | null;
  finance: FinanceResult | null;
  lease: LeaseResult | null;
  methods: MethodComparison[];
  liquidity: {
    /**
     * Optional and operator-entered: the value of capital a structure leaves in
     * the business, compounded at a rate the operator supplies. Null unless enabled.
     */
    retainedValue: Record<string, number> | null;
    /** Difference in scheduled monthly cash requirement between finance and lease. */
    monthlyDifference: number | null;
    monthlyDifferenceOverTerm: number | null;
    /** Cash purchase outlay less the initial cash required under a financed structure. */
    initialLiquidityRetained: { versus: MethodKey; amount: number } | null;
  };
  takeaways: string[];
}

export const METHOD_LABELS: Record<MethodKey, string> = {
  cash: 'Cash',
  finance: 'Finance',
  lease: 'Open-End / TRAC Lease',
};

export function resolveComparisonMonth(deal: Deal): number {
  if (deal.comparisonMonthMode === 'custom') {
    return Math.max(0, Math.round(deal.comparisonMonth));
  }
  // The lease term governs when both structures are measured. A longer loan is
  // then shown with its remaining payoff at that date, which is the honest
  // comparison rather than running the lease past maturity.
  if (deal.methods.lease) return deal.lease.termMonths;
  if (deal.methods.finance) return deal.finance.termMonths;
  return Math.max(0, Math.round(deal.comparisonMonth));
}

export function computeComparison(deal: Deal): ComparisonResult {
  const activeMethods = (['cash', 'finance', 'lease'] as MethodKey[]).filter((m) => deal.methods[m]);
  const month = resolveComparisonMonth(deal);
  const value = round2(deal.estimatedVehicleValue);
  const trade = computeTrade(deal);

  const cash = deal.methods.cash ? computeCash(deal) : null;
  const finance = deal.methods.finance ? computeFinance(deal) : null;
  const lease = deal.methods.lease ? computeLease(deal) : null;

  const methods: MethodComparison[] = [];

  if (cash) {
    methods.push({
      key: 'cash',
      label: METHOD_LABELS.cash,
      initialCash: cash.cashRequired,
      monthlyPayment: null,
      termMonths: null,
      apr: null,
      startingBalance: null,
      amountAmortized: null,
      scheduledEndingBalance: null,
      cumulativeCash: cash.cashRequired,
      totalScheduledPayments: null,
      totalInterest: null,
      payoffAtComparison: 0,
      estimatedVehicleValue: value,
      estimatedEquity: value,
      residualPercent: null,
      netCostOfUse: cash.cashRequired - value,
    });
  }

  if (finance) {
    const payoff = finance.payoffAtMonth(month);
    methods.push({
      key: 'finance',
      label: METHOD_LABELS.finance,
      initialCash: finance.initialCash,
      monthlyPayment: finance.payment,
      termMonths: finance.termMonths,
      apr: finance.apr,
      startingBalance: finance.amountFinanced,
      amountAmortized: round2(finance.amountFinanced - payoff),
      scheduledEndingBalance: 0,
      cumulativeCash: finance.cumulativeCashThroughMonth(month),
      totalScheduledPayments: finance.totalScheduledPayments,
      totalInterest: finance.totalInterest,
      payoffAtComparison: payoff,
      estimatedVehicleValue: value,
      estimatedEquity: round2(value - payoff),
      residualPercent: null,
      netCostOfUse: round2(finance.cumulativeCashThroughMonth(month) - (value - payoff)),
    });
  }

  if (lease) {
    const payoff = lease.payoffAtMonth(month);
    methods.push({
      key: 'lease',
      label: METHOD_LABELS.lease,
      initialCash: lease.initialCash,
      monthlyPayment: lease.payment,
      termMonths: lease.termMonths,
      apr: lease.apr,
      startingBalance: lease.capitalizedAmount,
      amountAmortized: round2(lease.capitalizedAmount - payoff),
      scheduledEndingBalance: lease.residualAmount,
      cumulativeCash: lease.cumulativeCashThroughMonth(month),
      totalScheduledPayments: lease.totalScheduledPayments,
      totalInterest: lease.totalInterest,
      payoffAtComparison: payoff,
      estimatedVehicleValue: value,
      estimatedEquity: round2(value - payoff),
      residualPercent: lease.residualPercent,
      netCostOfUse: round2(lease.cumulativeCashThroughMonth(month) - (value - payoff)),
    });
  }

  const monthlyDifference =
    finance && lease ? round2(finance.payment - lease.payment) : null;
  const termForDifference = lease ? lease.termMonths : finance ? finance.termMonths : 0;

  let initialLiquidityRetained: { versus: MethodKey; amount: number } | null = null;
  if (cash && (finance || lease)) {
    const alternative = finance ?? lease!;
    const versus: MethodKey = finance ? 'finance' : 'lease';
    initialLiquidityRetained = {
      versus,
      amount: round2(cash.cashRequired - alternative.initialCash),
    };
  }

  const costs = buildCosts(deal, 'finance');

  return {
    activeMethods,
    quantity: Math.max(1, Math.round(deal.quantity || 1)),
    comparisonMonth: month,
    estimatedVehicleValue: value,
    totalProjectCost: costs.totalProjectCost,
    nextVehiclePrice: deal.nextVehiclePrice > 0 ? deal.nextVehiclePrice : costs.acquisitionPrice,
    trade,
    cash,
    finance,
    lease,
    methods,
    liquidity: {
      retainedValue: liquidityValue(deal, methods, month),
      monthlyDifference,
      monthlyDifferenceOverTerm:
        monthlyDifference === null ? null : round2(monthlyDifference * termForDifference),
      initialLiquidityRetained,
    },
    takeaways: buildTakeaways({ methods, finance, lease, cash, month, value, monthlyDifference, initialLiquidityRetained }),
  };
}

/**
 * Future value at the comparison month of the cash each structure does NOT
 * require, measured against whichever structure demands the most cash, at a
 * return the operator states. No return is assumed unless it is entered.
 */
function liquidityValue(
  deal: Deal,
  methods: MethodComparison[],
  month: number,
): Record<string, number> | null {
  if (!deal.liquidity.enabled || deal.liquidity.reinvestmentRate <= 0 || methods.length < 2) return null;
  const r = deal.liquidity.reinvestmentRate / 12;

  const series = (m: MethodComparison): number[] => {
    const out: number[] = [];
    for (let t = 0; t <= month; t++) {
      if (t === 0) out.push(m.initialCash);
      else if (m.monthlyPayment !== null && t <= (m.termMonths ?? 0)) out.push(m.monthlyPayment);
      else out.push(0);
    }
    return out;
  };

  const all = methods.map(series);
  const reference = methods.reduce((a, b) => (b.cumulativeCash > a.cumulativeCash ? b : a));
  const ref = series(reference);

  const result: Record<string, number> = {};
  methods.forEach((m, i) => {
    let fv = 0;
    for (let t = 0; t <= month; t++) {
      const retained = ref[t] - all[i][t];
      fv = (fv + retained) * (1 + r);
    }
    result[m.key] = round2(fv);
  });
  return result;
}

interface TakeawayInput {
  methods: MethodComparison[];
  finance: FinanceResult | null;
  lease: LeaseResult | null;
  cash: CashResult | null;
  month: number;
  value: number;
  monthlyDifference: number | null;
  initialLiquidityRetained: { versus: MethodKey; amount: number } | null;
}

/**
 * Statements are generated from computed figures only. They describe the mechanics of
 * each structure; they never rank the structures or recommend one.
 */
function buildTakeaways(input: TakeawayInput): string[] {
  const { finance, lease, cash, month, value, monthlyDifference, initialLiquidityRetained } = input;
  const out: string[] = [];

  if (finance && lease && monthlyDifference !== null) {
    const higher = monthlyDifference >= 0 ? 'Finance' : 'The lease';
    const lower = monthlyDifference >= 0 ? 'the lease' : 'finance';
    const diff = formatCurrency(Math.abs(monthlyDifference));
    out.push(
      `${higher} requires ${diff} more per month than ${lower}. The lease payment amortizes to a scheduled residual of ${formatMoneyCompact(
        lease.residualAmount,
      )} rather than to zero.`,
    );
  } else if (finance && !lease) {
    out.push(
      `Finance amortizes ${formatMoneyCompact(finance.amountFinanced)} to a scheduled balance of $0 over ${
        finance.termMonths
      } months at ${formatPercent(finance.apr)}.`,
    );
  } else if (lease && !finance) {
    out.push(
      `The lease amortizes ${formatMoneyCompact(lease.amountAmortized)} of a ${formatMoneyCompact(
        lease.capitalizedAmount,
      )} capitalized amount, leaving a scheduled residual of ${formatMoneyCompact(lease.residualAmount)} at month ${
        lease.termMonths
      }.`,
    );
  }

  const equityParts = input.methods.map(
    (m) => `${m.label.replace(' / TRAC Lease', '')} ${formatMoneyCompact(m.estimatedEquity)}`,
  );
  if (equityParts.length > 1) {
    out.push(
      `At an estimated vehicle value of ${formatMoneyCompact(value)} in month ${month}, estimated equity above any remaining payoff is: ${equityParts.join(
        ', ',
      )}.`,
    );
  }

  const negative = input.methods.filter((m) => m.estimatedEquity < 0);
  if (negative.length > 0) {
    out.push(
      `Estimated vehicle value is below the remaining payoff under ${negative
        .map((m) => m.label)
        .join(' and ')}, producing negative estimated equity at month ${month}.`,
    );
  }

  if (cash && initialLiquidityRetained && initialLiquidityRetained.amount > 0) {
    out.push(
      `Cash deploys ${formatMoneyCompact(
        cash.cashRequired,
      )} at acquisition and carries no finance charge. Under the financed structure, ${formatMoneyCompact(
        initialLiquidityRetained.amount,
      )} of that liquidity is retained at acquisition and repaid over the term.`,
    );
  }

  return out;
}
