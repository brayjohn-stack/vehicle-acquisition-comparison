import type { Deal } from '../types/deal';
import { maxResidual } from '../rates/ally';
import { applyProgramTerm } from '../rates/apply';
import { Field, IntegerInput, MoneyInput, PercentInput } from './fields';

interface Props {
  deal: Deal;
  onChange: (deal: Deal) => void;
  onClose: () => void;
}

/**
 * The handful of assumptions a client actually challenges mid-conversation,
 * reachable without leaving the presentation or showing them the setup screen.
 */
export default function QuickAdjust({ deal, onChange, onClose }: Props) {
  const set = (patch: Partial<Deal>) => onChange({ ...deal, ...patch });
  const residualCap = maxResidual(deal.lease.termMonths, deal.rates.tier);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Adjust assumptions">
        <div className="drawer-head">
          <span className="label">Adjust</span>
          <button className="btn btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="drawer-body">
          {deal.methods.finance && (
            <section>
              <h4>Finance</h4>
              <div className="field-grid">
                <Field label="APR">
                  <PercentInput value={deal.finance.apr} onChange={(v) => set({ finance: { ...deal.finance, apr: v } })} />
                </Field>
                <Field label="Term">
                  <IntegerInput
                    value={deal.finance.termMonths}
                    onChange={(v) => set({ finance: { ...deal.finance, termMonths: Math.max(1, v) } })}
                    suffix="mo"
                  />
                </Field>
                <Field label="Down payment">
                  <MoneyInput
                    value={deal.finance.downPayment}
                    onChange={(v) => set({ finance: { ...deal.finance, downPayment: v } })}
                  />
                </Field>
              </div>
            </section>
          )}

          {deal.methods.lease && (
            <section>
              <h4>Open-end lease</h4>
              <div className="field-grid">
                <Field label="APR">
                  <PercentInput value={deal.lease.apr} onChange={(v) => set({ lease: { ...deal.lease, apr: v } })} />
                </Field>
                <Field label="Term">
                  <IntegerInput
                    value={deal.lease.termMonths}
                    onChange={(v) => onChange(applyProgramTerm(deal, Math.max(1, v)))}
                    suffix="mo"
                  />
                </Field>
                <Field label="Residual" hint={`tier ${deal.rates.tier} max ${(residualCap * 100).toFixed(0)}%`}>
                  <PercentInput
                    value={deal.lease.residualPercent}
                    onChange={(v) => set({ lease: { ...deal.lease, residualMode: 'percent', residualPercent: v } })}
                  />
                </Field>
                <Field label="Cash at signing">
                  <MoneyInput
                    value={deal.lease.initialCash}
                    onChange={(v) => set({ lease: { ...deal.lease, initialCash: v } })}
                  />
                </Field>
              </div>
            </section>
          )}

          <section>
            <h4>Assumptions</h4>
            <div className="field-grid">
              <Field label="Value at comparison">
                <MoneyInput
                  value={deal.estimatedVehicleValue}
                  onChange={(v) => set({ estimatedVehicleValue: v })}
                />
              </Field>
              <Field label="Next vehicle cost">
                <MoneyInput value={deal.nextVehiclePrice} onChange={(v) => set({ nextVehiclePrice: v })} />
              </Field>
              <Field label="Quantity">
                <IntegerInput value={deal.quantity} onChange={(v) => set({ quantity: Math.max(1, v) })} suffix="units" />
              </Field>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
