import type { Deal } from '../types/deal';

export interface TradeResult {
  enabled: boolean;
  value: number;
  payoff: number;
  /** Trade value less payoff. Negative equity increases the amount to be capitalized. */
  equity: number;
  isNegative: boolean;
}

export function computeTrade(deal: Deal): TradeResult {
  if (!deal.trade.enabled) {
    return { enabled: false, value: 0, payoff: 0, equity: 0, isNegative: false };
  }
  const value = deal.trade.value;
  const payoff = deal.trade.payoff;
  const equity = value - payoff;
  return { enabled: true, value, payoff, equity, isNegative: equity < 0 };
}
