import type { Deal } from '../types/deal';
import { buildCosts } from './taxes';
import type { CostBuildUp } from './taxes';
import { computeTrade } from './trade';

export interface CashResult {
  costs: CostBuildUp;
  tradeEquityApplied: number;
  /** Cash required at acquisition. This is a deployment of capital, not an expense. */
  cashRequired: number;
  initialCash: number;
  payoffAtMonth: (month: number) => number;
  cumulativeCashThroughMonth: (month: number) => number;
}

export function computeCash(deal: Deal): CashResult {
  const costs = buildCosts(deal, 'cash');
  const trade = computeTrade(deal);
  // Positive trade equity reduces cash required; negative equity (payoff shortfall) increases it.
  const cashRequired = Math.max(0, costs.totalProjectCost - trade.equity);

  return {
    costs,
    tradeEquityApplied: trade.equity,
    cashRequired,
    initialCash: cashRequired,
    // No lien exists under a cash purchase.
    payoffAtMonth: () => 0,
    cumulativeCashThroughMonth: () => cashRequired,
  };
}
