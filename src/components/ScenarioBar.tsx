import type { Deal } from '../types/deal';
import type { ComparisonResult } from '../calculations/comparison';
import { formatMoneyCompact, formatPercent } from '../calculations/money';
import { applyProgramTerm } from '../rates/apply';

interface Props {
  deal: Deal;
  result: ComparisonResult;
  onChange: (deal: Deal) => void;
}

/**
 * Lets the operator move the two assumptions a client is most likely to
 * challenge — future vehicle value and the comparison date — without leaving
 * the presentation.
 */
export default function ScenarioBar({ deal, result, onChange }: Props) {
  const value = deal.estimatedVehicleValue;
  const residual = result.lease?.residualAmount ?? 0;
  const setValue = (v: number) => onChange({ ...deal, estimatedVehicleValue: Math.max(0, Math.round(v)) });

  const linked = deal.rates.kind !== 'manual' && deal.rates.linkTerms;
  const termOptions = [24, 36, 48, 60, 72];
  const setTerm = (m: number) => onChange({ ...applyProgramTerm(deal, m), comparisonMonthMode: 'term' });

  return (
    <div className="scenario">
      <div className="scenario-group">
        <span className="label">Estimated vehicle value</span>
        <div className="stepper">
          <button className="btn btn-quiet" onClick={() => setValue(value - 2500)} aria-label="Decrease by $2,500">
            −
          </button>
          <span className="stepper-value">{formatMoneyCompact(value)}</span>
          <button className="btn btn-quiet" onClick={() => setValue(value + 2500)} aria-label="Increase by $2,500">
            +
          </button>
        </div>
        {residual > 0 && (
          <div className="scenario-chips">
            <button className="chip-btn" onClick={() => setValue(residual * 0.85)}>
              Below residual
            </button>
            <button className="chip-btn" onClick={() => setValue(residual)}>
              At residual
            </button>
            <button className="chip-btn" onClick={() => setValue(residual * 1.25)}>
              Above residual
            </button>
          </div>
        )}
      </div>

      {deal.methods.lease && (
        <div className="scenario-group">
          <span className="label">Lease term</span>
          <div className="scenario-chips">
            {termOptions.map((m) => (
              <button key={m} className="chip-btn" aria-pressed={deal.lease.termMonths === m} onClick={() => setTerm(m)}>
                {m} mo
              </button>
            ))}
          </div>
          {linked && result.lease && (
            <span className="note" style={{ margin: 0 }}>
              {formatPercent(result.lease.apr)} · residual {formatPercent(result.lease.residualPercent, 0)} from the tier{' '}
              {deal.rates.tier} sheet
            </span>
          )}
        </div>
      )}
    </div>
  );
}
