import type { Deal } from '../types/deal';
import { deriveVehicleClass, maxResidual, programRate } from './ally';

/**
 * When the deal is linked to a lender program, the term is the only thing the
 * operator picks. Rate and residual follow from the sheet: the rate from the
 * class/term/tier grid, the residual from the maximum for that term and tier.
 *
 * A 24 month lease does not carry a 60 month residual, and having to remember
 * that by hand is how a quote goes out wrong.
 */
export function applyProgramTerm(deal: Deal, termMonths: number): Deal {
  const term = Math.max(1, Math.round(termMonths));
  const r = deal.rates;
  const lease = { ...deal.lease, termMonths: term };

  if (r.kind === 'manual' || !r.linkTerms) {
    return { ...deal, lease };
  }

  const { vehicleClass } = deriveVehicleClass(r.condition, r.modelYear);
  const rate = programRate({
    kind: r.kind,
    tier: r.tier,
    vehicleClass,
    termMonths: term,
    municipalOutstandings: r.municipalOutstandings,
    federalExempt: r.federalExempt,
  });

  return {
    ...deal,
    lease: {
      ...lease,
      apr: rate ?? lease.apr,
      // Municipal lease purchase has no residual grid; only ComTRAC is capped here.
      residualMode: r.kind === 'comtrac' ? 'percent' : lease.residualMode,
      residualPercent: r.kind === 'comtrac' ? maxResidual(term, r.tier) : lease.residualPercent,
    },
    finance: r.applyToFinance ? { ...deal.finance, apr: rate ?? deal.finance.apr } : deal.finance,
  };
}

/** Re-derives rate and residual after a tier, condition or model year change. */
export function resyncProgram(deal: Deal): Deal {
  return applyProgramTerm(deal, deal.lease.termMonths);
}

/** True when the lease rate or residual has drifted from what the sheet would quote. */
export function isProgramSynced(deal: Deal): boolean {
  if (deal.rates.kind === 'manual') return true;
  const synced = applyProgramTerm({ ...deal, rates: { ...deal.rates, linkTerms: true } }, deal.lease.termMonths);
  return (
    Math.abs(synced.lease.apr - deal.lease.apr) < 1e-9 &&
    Math.abs(synced.lease.residualPercent - deal.lease.residualPercent) < 1e-9
  );
}
