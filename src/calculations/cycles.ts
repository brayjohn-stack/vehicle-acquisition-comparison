import type { Deal, MethodKey } from '../types/deal';
import { computeCash } from './cash';
import { computeFinance } from './finance';
import { computeLease } from './lease';
import { acquisitionPrice } from './taxes';

export interface CycleLeg {
  cycle: number;
  vehiclePrice: number;
  /** Equity carried in from the previous cycle. Negative means paid at termination. */
  equityApplied: number;
  monthlyPayment: number | null;
  cashOutflow: number;
  endingValue: number;
  endingPayoff: number;
  endingEquity: number;
}

export interface CycleProjection {
  key: MethodKey;
  legs: CycleLeg[];
  totalMonths: number;
  totalCashOutflow: number;
  finalEquity: number;
  /** Total outflow across every cycle less the equity still held at the end. */
  netCost: number;
}

/**
 * Projects successive replacement cycles on the same terms. Equity at the end of
 * one cycle is applied to the next; a shortfall is paid at termination instead.
 *
 * Every cycle reuses the same engines as the single-term comparison, so nothing
 * here re-implements payment or amortization maths.
 */
export function projectCycles(deal: Deal, method: MethodKey, cycles: number): CycleProjection {
  const basePrice = acquisitionPrice(deal);
  const nextPrice = deal.nextVehiclePrice > 0 ? deal.nextVehiclePrice : basePrice;
  // Residual value is carried forward as a share of price rather than a fixed
  // dollar amount, so a more expensive replacement is valued consistently.
  const valueRatio = basePrice > 0 ? deal.estimatedVehicleValue / basePrice : 0;
  const termMonths =
    method === 'lease' ? deal.lease.termMonths : method === 'finance' ? deal.finance.termMonths : deal.lease.termMonths;

  const legs: CycleLeg[] = [];
  let carriedEquity = 0;

  for (let cycle = 1; cycle <= Math.max(1, cycles); cycle++) {
    const price = cycle === 1 ? basePrice : nextPrice;
    const endingValue = cycle === 1 ? deal.estimatedVehicleValue : price * valueRatio;
    const applied = Math.max(0, carriedEquity);
    const shortfall = carriedEquity < 0 ? Math.abs(carriedEquity) : 0;

    const cycleDeal: Deal = {
      ...deal,
      acquisitionPrice: price,
      msrp: price,
      // The trade is part of cycle one only; later cycles roll equity forward instead.
      trade: cycle === 1 ? deal.trade : { enabled: false, value: 0, payoff: 0 },
      finance: { ...deal.finance, downPayment: cycle === 1 ? deal.finance.downPayment : applied },
      lease: { ...deal.lease, initialCash: cycle === 1 ? deal.lease.initialCash : applied },
      estimatedVehicleValue: endingValue,
    };

    let monthlyPayment: number | null = null;
    let cashOutflow = 0;
    let endingPayoff = 0;

    if (method === 'cash') {
      const cash = computeCash(cycleDeal);
      cashOutflow = Math.max(0, cash.cashRequired - applied);
    } else if (method === 'finance') {
      const f = computeFinance(cycleDeal);
      monthlyPayment = f.payment;
      cashOutflow = f.cumulativeCashThroughMonth(termMonths);
      endingPayoff = f.payoffAtMonth(termMonths);
    } else {
      const l = computeLease(cycleDeal);
      monthlyPayment = l.payment;
      cashOutflow = l.cumulativeCashThroughMonth(termMonths);
      endingPayoff = l.payoffAtMonth(termMonths);
    }

    cashOutflow += shortfall;
    const endingEquity = endingValue - endingPayoff;

    legs.push({
      cycle,
      vehiclePrice: price,
      equityApplied: carriedEquity,
      monthlyPayment,
      cashOutflow,
      endingValue,
      endingPayoff,
      endingEquity,
    });

    carriedEquity = endingEquity;
  }

  const totalCashOutflow = legs.reduce((s, l) => s + l.cashOutflow, 0);
  const finalEquity = legs[legs.length - 1].endingEquity;

  return {
    key: method,
    legs,
    totalMonths: termMonths * legs.length,
    totalCashOutflow,
    finalEquity,
    netCost: totalCashOutflow - finalEquity,
  };
}
