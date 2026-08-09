import type { Deal } from '../types/deal';
import { acquisitionPrice, capitalizedAdditions } from './taxes';

export interface Valuation {
  /** Base vehicle only: dealer invoice when new, book wholesale when used. */
  baseValue: number;
  /** Capitalized upfits valued at the dealer's cost. */
  upfitsAtCost: number;
  /** What the lender's advance test is measured against. */
  edcAwv: number;
  /**
   * True when no base value was entered and the selling price stood in. Selling
   * price is higher than invoice or book, so the advance shown is understated.
   */
  estimated: boolean;
}

/** Capitalized additions valued at dealer cost, falling back to the retail amount. */
export function upfitsAtCost(deal: Deal): number {
  return deal.additionalCosts
    .filter((c) => c.capitalized)
    .reduce((sum, c) => sum + (c.dealerCost > 0 ? c.dealerCost : c.amount), 0);
}

/**
 * Ally values the deal against EDC (new: dealer invoice) or AWV (used: book
 * wholesale), including upfits at cost. Ally pulls its own figure from the VIN on
 * submission; this is the operator's estimate of what that figure will be.
 */
export function computeValuation(deal: Deal): Valuation {
  const base = deal.rates.baseVehicleValue;
  const upfits = upfitsAtCost(deal);
  if (base > 0) {
    return { baseValue: base, upfitsAtCost: upfits, edcAwv: base + upfits, estimated: false };
  }
  return {
    baseValue: acquisitionPrice(deal),
    upfitsAtCost: capitalizedAdditions(deal),
    edcAwv: acquisitionPrice(deal) + capitalizedAdditions(deal),
    estimated: true,
  };
}
