import { round2 } from './money';
import type { PaymentTiming } from '../types/deal';

export interface AmortizationRow {
  period: number;
  beginningBalance: number;
  payment: number;
  interest: number;
  principal: number;
  endingBalance: number;
}

export interface AmortizationResult {
  /** Unrounded payment straight from the closed-form solution. */
  paymentExact: number;
  /** Contract-style payment rounded to cents. Used to build the schedule. */
  payment: number;
  schedule: AmortizationRow[];
  totalPayments: number;
  totalInterest: number;
  principalPaid: number;
  /** Scheduled balance remaining at the end of the term (0 for a loan, residual for a lease). */
  endingBalance: number;
}

/**
 * Closed-form payment for a level-payment obligation with an optional balloon / residual (fv).
 *
 *   Arrears:  Pmt = (PV - FV / (1+r)^n) * r / (1 - (1+r)^-n)
 *   Advance:  Pmt = Arrears / (1 + r)
 *   r = 0:    Pmt = (PV - FV) / n
 */
export function balloonPayment(
  pv: number,
  apr: number,
  termMonths: number,
  fv = 0,
  timing: PaymentTiming = 'arrears',
): number {
  const n = Math.max(0, Math.round(termMonths));
  if (n === 0) return 0;
  const r = apr / 12;
  if (Math.abs(r) < 1e-12) return (pv - fv) / n;
  const growth = Math.pow(1 + r, n);
  const arrears = ((pv * growth - fv) * r) / (growth - 1);
  return timing === 'advance' ? arrears / (1 + r) : arrears;
}

/** Payment that lands the balance exactly on `fv` in a single remaining period. */
function finalPeriodPayment(beginning: number, r: number, fv: number, timing: PaymentTiming): number {
  if (timing === 'advance') return beginning - fv / (1 + r);
  return beginning * (1 + r) - fv;
}

/**
 * Builds the full schedule using the cents-rounded payment, then solves the final
 * payment so the ending balance reconciles exactly to `fv` with no cumulative drift.
 */
export function buildSchedule(
  pv: number,
  apr: number,
  termMonths: number,
  fv = 0,
  timing: PaymentTiming = 'arrears',
): AmortizationResult {
  const n = Math.max(0, Math.round(termMonths));
  const r = apr / 12;
  const paymentExact = balloonPayment(pv, apr, n, fv, timing);
  const payment = round2(paymentExact);

  const schedule: AmortizationRow[] = [];
  let balance = pv;
  let totalPayments = 0;
  let totalInterest = 0;

  for (let period = 1; period <= n; period++) {
    const beginningBalance = balance;
    const isFinal = period === n;
    // The final payment is solved so the schedule reconciles exactly to `fv`,
    // absorbing the cents-rounding of the level payment instead of drifting.
    const pay = isFinal ? round2(finalPeriodPayment(beginningBalance, r, fv, timing)) : payment;
    const interestBase = timing === 'advance' ? beginningBalance - pay : beginningBalance;
    const interest = interestBase * r;
    const principal = pay - interest;
    const endingBalance = isFinal ? fv : beginningBalance - principal;

    schedule.push({ period, beginningBalance, payment: pay, interest, principal, endingBalance });

    balance = endingBalance;
    totalPayments += pay;
    totalInterest += interest;
  }

  return {
    paymentExact,
    payment,
    schedule,
    totalPayments,
    totalInterest,
    principalPaid: n > 0 ? pv - fv : 0,
    endingBalance: n > 0 ? fv : pv,
  };
}

/** Scheduled balance still owed after `month` scheduled payments have been made. */
export function balanceAtMonth(result: AmortizationResult, month: number, pv: number): number {
  if (month <= 0) return pv;
  const n = result.schedule.length;
  if (month >= n) return result.endingBalance;
  return result.schedule[month - 1].endingBalance;
}

/** Sum of scheduled payments made through `month` (payments are capped at the term). */
export function paymentsThroughMonth(result: AmortizationResult, month: number): number {
  const capped = Math.max(0, Math.min(Math.round(month), result.schedule.length));
  let total = 0;
  for (let i = 0; i < capped; i++) total += result.schedule[i].payment;
  return total;
}

/** Interest charged through `month`. */
export function interestThroughMonth(result: AmortizationResult, month: number): number {
  const capped = Math.max(0, Math.min(Math.round(month), result.schedule.length));
  let total = 0;
  for (let i = 0; i < capped; i++) total += result.schedule[i].interest;
  return total;
}

/**
 * Interest accrued between the standard 30-day first payment and a later first
 * payment date, on a 360-day basis. 45 days yields PV × APR / 24, which is the
 * convention used on the source buyer's orders.
 */
export function deferralInterest(pv: number, apr: number, firstPaymentDays: number): number {
  const extraDays = (firstPaymentDays || 30) - 30;
  if (extraDays <= 0 || apr <= 0 || pv <= 0) return 0;
  return pv * apr * (extraDays / 360);
}
