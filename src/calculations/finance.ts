import type { Deal } from '../types/deal';
import { buildSchedule, balanceAtMonth, paymentsThroughMonth, interestThroughMonth } from './amortization';
import type { AmortizationResult } from './amortization';
import { buildCosts } from './taxes';
import type { CostBuildUp } from './taxes';
import { computeTrade } from './trade';
import { deferralInterest } from './amortization';

export interface FinanceResult {
  costs: CostBuildUp;
  /** Interest capitalized because the first payment is deferred beyond 30 days. */
  deferredInterest: number;
  downPayment: number;
  tradeEquityApplied: number;
  amountFinanced: number;
  apr: number;
  termMonths: number;
  timing: 'arrears' | 'advance';
  payment: number;
  paymentExact: number;
  amortization: AmortizationResult;
  /** A loan amortizes the whole financed balance. */
  amountAmortized: number;
  scheduledEndingBalance: number;
  totalScheduledPayments: number;
  totalInterest: number;
  initialCash: number;
  payoffAtMonth: (month: number) => number;
  cumulativeCashThroughMonth: (month: number) => number;
  interestThroughMonth: (month: number) => number;
}

export function computeFinance(deal: Deal): FinanceResult {
  const costs = buildCosts(deal, 'finance');
  const trade = computeTrade(deal);
  const downPayment = Math.max(0, deal.finance.downPayment);
  const baseAmount = Math.max(0, costs.grossAmount - downPayment - trade.equity);
  const { apr, termMonths, timing, firstPaymentDays } = deal.finance;
  // Days beyond the standard 30 accrue interest that is capitalized into the
  // financed amount — the "@ 45 days" convention on the buyer's order.
  const deferredInterest = deferralInterest(baseAmount, apr, firstPaymentDays);
  const amountFinanced = baseAmount + deferredInterest;

  const amortization = buildSchedule(amountFinanced, apr, termMonths, 0, timing);
  const paymentsAtSigning = timing === 'advance' ? 1 : 0;
  const upfrontNonFinanced = downPayment + costs.nonCapitalizedAdditions;

  const cumulativeCashThroughMonth = (month: number) => {
    const count = Math.max(month, paymentsAtSigning);
    return upfrontNonFinanced + paymentsThroughMonth(amortization, count);
  };

  return {
    costs,
    deferredInterest,
    downPayment,
    tradeEquityApplied: trade.equity,
    amountFinanced,
    apr,
    termMonths,
    timing,
    payment: amortization.payment,
    paymentExact: amortization.paymentExact,
    amortization,
    amountAmortized: amountFinanced,
    scheduledEndingBalance: 0,
    totalScheduledPayments: amortization.totalPayments,
    totalInterest: amortization.totalInterest,
    initialCash: cumulativeCashThroughMonth(0),
    payoffAtMonth: (month: number) => balanceAtMonth(amortization, month, amountFinanced),
    cumulativeCashThroughMonth,
    interestThroughMonth: (month: number) => interestThroughMonth(amortization, Math.max(month, 0)),
  };
}
