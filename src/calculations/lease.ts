import type { Deal } from '../types/deal';
import { buildSchedule, balanceAtMonth, paymentsThroughMonth, interestThroughMonth } from './amortization';
import type { AmortizationResult } from './amortization';
import { buildCosts, acquisitionPrice } from './taxes';
import type { CostBuildUp } from './taxes';
import { computeTrade } from './trade';
import { deferralInterest } from './amortization';

export interface LeaseResult {
  costs: CostBuildUp;
  deferredInterest: number;
  initialCashReduction: number;
  tradeEquityApplied: number;
  capitalizedAmount: number;
  apr: number;
  termMonths: number;
  timing: 'arrears' | 'advance';
  residualBasis: number;
  residualPercent: number;
  residualAmount: number;
  payment: number;
  paymentExact: number;
  amortization: AmortizationResult;
  /** A lease amortizes only down to the residual. */
  amountAmortized: number;
  scheduledEndingBalance: number;
  totalScheduledPayments: number;
  totalInterest: number;
  initialCash: number;
  payoffAtMonth: (month: number) => number;
  cumulativeCashThroughMonth: (month: number) => number;
  interestThroughMonth: (month: number) => number;
}

export function residualBasisAmount(deal: Deal, capitalizedAmount: number): number {
  switch (deal.lease.residualBasis) {
    case 'msrp':
      return deal.msrp;
    case 'capitalizedAmount':
      return capitalizedAmount;
    case 'custom':
      return deal.lease.residualBasisCustom;
    case 'acquisitionPrice':
    default:
      return acquisitionPrice(deal);
  }
}

export function computeLease(deal: Deal): LeaseResult {
  const costs = buildCosts(deal, 'lease');
  const trade = computeTrade(deal);
  const initialCashReduction = Math.max(0, deal.lease.initialCash);
  const baseAmount = Math.max(0, costs.grossAmount - initialCashReduction - trade.equity);
  const { apr, termMonths, timing, firstPaymentDays } = deal.lease;
  const deferredInterest = deferralInterest(baseAmount, apr, firstPaymentDays);
  const capitalizedAmount = baseAmount + deferredInterest;

  const basis = residualBasisAmount(deal, capitalizedAmount);
  const residualAmount =
    deal.lease.residualMode === 'amount'
      ? Math.max(0, deal.lease.residualAmount)
      : Math.max(0, basis * deal.lease.residualPercent);
  const residualPercent = basis > 0 ? residualAmount / basis : 0;

  const amortization = buildSchedule(capitalizedAmount, apr, termMonths, residualAmount, timing);
  const paymentsAtSigning = timing === 'advance' ? 1 : 0;
  const upfrontNonCapitalized = initialCashReduction + costs.nonCapitalizedAdditions;

  const cumulativeCashThroughMonth = (month: number) => {
    const count = Math.max(month, paymentsAtSigning);
    return upfrontNonCapitalized + paymentsThroughMonth(amortization, count);
  };

  return {
    costs,
    deferredInterest,
    initialCashReduction,
    tradeEquityApplied: trade.equity,
    capitalizedAmount,
    apr,
    termMonths,
    timing,
    residualBasis: basis,
    residualPercent,
    residualAmount,
    payment: amortization.payment,
    paymentExact: amortization.paymentExact,
    amortization,
    amountAmortized: capitalizedAmount - residualAmount,
    scheduledEndingBalance: residualAmount,
    totalScheduledPayments: amortization.totalPayments,
    totalInterest: amortization.totalInterest,
    initialCash: cumulativeCashThroughMonth(0),
    payoffAtMonth: (month: number) => balanceAtMonth(amortization, month, capitalizedAmount),
    cumulativeCashThroughMonth,
    interestThroughMonth: (month: number) => interestThroughMonth(amortization, Math.max(month, 0)),
  };
}
