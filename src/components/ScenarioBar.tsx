import type { Deal } from '../types/deal';
import type { ComparisonResult } from '../calculations/comparison';
import { formatMoneyCompact } from '../calculations/money';

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
  const setMonth = (m: number) => onChange({ ...deal, comparisonMonthMode: 'custom', comparisonMonth: m });

  const terms = [deal.methods.finance ? deal.finance.termMonths : 0, deal.methods.lease ? deal.lease.termMonths : 0];
  const maxTerm = Math.max(...terms, 0);
  const months = [24, 36, 48, 60, 72].filter((m) => m <= maxTerm);

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

      {months.length > 1 && (
        <div className="scenario-group">
          <span className="label">Position at month</span>
          <div className="scenario-chips">
            {months.map((m) => (
              <button
                key={m}
                className="chip-btn"
                aria-pressed={result.comparisonMonth === m}
                onClick={() => setMonth(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
