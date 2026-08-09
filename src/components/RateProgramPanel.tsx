import type { Deal } from '../types/deal';
import type { AllyTier, RateProgramKind, VehicleCondition } from '../rates/ally';
import {
  RATE_SHEET_EFFECTIVE,
  TIERS,
  VEHICLE_CLASS_LABELS,
  checkProgram,
  comtracRate,
  deriveVehicleClass,
  maxAdvance,
  maxResidual,
  municipalBandLabel,
  programRate,
} from '../rates/ally';
import { computeLease } from '../calculations/lease';
import { computeValuation } from '../calculations/valuation';
import { formatCurrency, formatPercent } from '../calculations/money';
import { Check, Field, IntegerInput, MoneyInput, Panel, PercentInput, Segmented } from './fields';

/**
 * Lender program selection. The Ally sheet is marked for dealer use only, so this
 * panel lives in setup and nothing from it reaches the client presentation.
 */
export default function RateProgramPanel({ deal, onChange }: { deal: Deal; onChange: (deal: Deal) => void }) {
  const set = (patch: Partial<Deal['rates']>) => onChange({ ...deal, rates: { ...deal.rates, ...patch } });
  const r = deal.rates;
  const lease = computeLease(deal);
  const valuation = computeValuation(deal);
  const edc = valuation.edcAwv;
  const derived = deriveVehicleClass(r.condition, r.modelYear);
  const vehicleClass = derived.vehicleClass;
  const valueLabel = r.condition === 'new' ? 'EDC — dealer invoice' : 'AWV — book wholesale';

  const quoted = programRate({
    kind: r.kind,
    tier: r.tier,
    vehicleClass,
    termMonths: deal.lease.termMonths,
    municipalOutstandings: r.municipalOutstandings,
    federalExempt: r.federalExempt,
  });

  const checks = checkProgram({
    kind: r.kind,
    tier: r.tier,
    vehicleClass,
    termMonths: deal.lease.termMonths,
    residualPercent: lease.residualPercent,
    amountAdvanced: lease.capitalizedAmount,
    edcAwv: edc,
    directOrEv: r.directOrEv,
    municipalOutstandings: r.municipalOutstandings,
  });

  const residualCap = maxResidual(deal.lease.termMonths, r.tier);
  const advanceCap = maxAdvance(deal.lease.termMonths, r.tier, edc);
  const requiredDown = Math.max(0, lease.capitalizedAmount - advanceCap * edc);

  const applyRate = () => {
    if (quoted === null) return;
    onChange({
      ...deal,
      lease: { ...deal.lease, apr: quoted },
      finance: r.applyToFinance ? { ...deal.finance, apr: quoted } : deal.finance,
    });
  };

  return (
    <Panel title="Lender program" hint={`Ally rate sheet effective ${RATE_SHEET_EFFECTIVE}`}>
      <div className="field-grid">
        <Field label="Program">
          <select className="plain" value={r.kind} onChange={(e) => set({ kind: e.target.value as RateProgramKind })}>
            <option value="comtrac">ComTRAC lease</option>
            <option value="municipal">Municipal lease purchase</option>
            <option value="manual">Manual — enter rates myself</option>
          </select>
        </Field>
        <Field label="Condition">
          <Segmented
            value={r.condition}
            options={[
              { value: 'new' as VehicleCondition, label: 'New' },
              { value: 'used' as VehicleCondition, label: 'Used' },
            ]}
            onChange={(v) => set({ condition: v })}
          />
        </Field>
        <Field label="Model year">
          <IntegerInput value={r.modelYear} onChange={(v) => set({ modelYear: v })} />
        </Field>
        <Field label="Rate class" hint="derived">
          <div className="input" style={{ background: '#fbfbfa' }}>
            <span style={{ fontSize: 12.5, color: derived.supported ? 'var(--navy)' : 'var(--negative)' }}>
              {VEHICLE_CLASS_LABELS[vehicleClass]}
            </span>
          </div>
        </Field>

        {r.kind === 'comtrac' && (
          <Field label="Credit tier">
            <select className="plain" value={r.tier} onChange={(e) => set({ tier: e.target.value as AllyTier })}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  Tier {t} — {formatPercent(comtracRate(vehicleClass, deal.lease.termMonths, t))} at{' '}
                  {deal.lease.termMonths} mo
                </option>
              ))}
            </select>
          </Field>
        )}

        {r.kind === 'municipal' && (
          <Field label="Outstandings plus pending" hint={municipalBandLabel(r.municipalOutstandings)}>
            <MoneyInput
              value={r.municipalOutstandings}
              onChange={(v) => set({ municipalOutstandings: v })}
            />
          </Field>
        )}

        <Field label={valueLabel} hint="base vehicle only">
          <MoneyInput value={r.baseVehicleValue} onChange={(v) => set({ baseVehicleValue: v })} />
        </Field>
      </div>

      <p className="note" style={{ marginBottom: 0 }}>
        {derived.note}
      </p>

      <div className="valuation">
        <span>
          {valuation.estimated ? 'Selling price' : r.condition === 'new' ? 'Dealer invoice' : 'Book wholesale'}{' '}
          {formatCurrency(valuation.baseValue, 0)}
        </span>
        <span className="op">+</span>
        <span>upfits at cost {formatCurrency(valuation.upfitsAtCost, 0)}</span>
        <span className="op">=</span>
        <strong>{formatCurrency(valuation.edcAwv, 0)} EDC / AWV</strong>
      </div>
      {valuation.estimated && (
        <p className="note warn" style={{ marginBottom: 0 }}>
          No {r.condition === 'new' ? 'dealer invoice' : 'book wholesale value'} entered, so the selling price is standing
          in. Invoice and book values are lower than selling price, so the advance below is understated — the real figure
          is higher. Enter the {r.condition === 'new' ? 'invoice' : 'book value'} before relying on it.
        </p>
      )}

      {r.kind !== 'manual' && (
        <>
          <div className="row-divider" />
          <div className="program-quote">
            <div>
              <span className="label">Program rate</span>
              <div className="figure-sm">{quoted === null ? '—' : formatPercent(quoted)}</div>
            </div>
            <div>
              <span className="label">Max residual</span>
              <div className="figure-sm">{r.kind === 'comtrac' ? formatPercent(residualCap, 0) : '—'}</div>
            </div>
            <div>
              <span className="label">Max advance</span>
              <div className="figure-sm">{formatPercent(advanceCap, 0)}</div>
              <span className="note" style={{ fontSize: 11 }}>
                {edc >= 80000 ? 'EDC/AWV at or above $80,000' : 'EDC/AWV under $80,000'}
              </span>
            </div>
            <button className="btn btn-primary" onClick={applyRate} disabled={quoted === null}>
              Apply rate
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <Check checked={r.applyToFinance} onChange={(v) => set({ applyToFinance: v })}>
              Apply this rate to the finance column too
            </Check>
            {r.kind === 'comtrac' && (
              <>
                <Check checked={r.federalExempt} onChange={(v) => set({ federalExempt: v })}>
                  Federal exempt status — adds 0.75 points to the lease rate
                </Check>
                <Check checked={r.directOrEv} onChange={(v) => set({ directOrEv: v })}>
                  Direct ComTRAC or electric vehicle — 20% minimum residual, 60 month maximum
                </Check>
              </>
            )}
          </div>

          {requiredDown > 0 && (
            <div className="program-action">
              <span>
                {formatCurrency(requiredDown, 0)} over the advance cap. Applying it as a capital reduction brings the deal
                inside program limits.
              </span>
              <button
                className="btn"
                onClick={() =>
                  onChange({
                    ...deal,
                    lease: { ...deal.lease, initialCash: Math.round(requiredDown) },
                    finance: { ...deal.finance, downPayment: Math.round(requiredDown) },
                  })
                }
              >
                Apply as down payment
              </button>
            </div>
          )}

          <ul className="checks">
            {checks.map((c, i) => (
              <li key={i} data-level={c.level}>
                {c.message}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="row-divider" />
      <Check
        checked={deal.liquidity.enabled}
        onChange={(v) => onChange({ ...deal, liquidity: { ...deal.liquidity, enabled: v } })}
      >
        Value the liquidity each structure leaves in the business
      </Check>
      {deal.liquidity.enabled && (
        <div className="field-grid" style={{ marginTop: 10 }}>
          <Field label="Expected annual return" hint="your assumption">
            <PercentInput
              value={deal.liquidity.reinvestmentRate}
              onChange={(v) => onChange({ ...deal, liquidity: { ...deal.liquidity, reinvestmentRate: v } })}
            />
          </Field>
        </div>
      )}
      {deal.liquidity.enabled && (
        <p className="note" style={{ marginBottom: 0 }}>
          This is a stated assumption, not a projection. It compounds the cash a structure does not require, measured
          against whichever structure demands the most.
        </p>
      )}
    </Panel>
  );
}
