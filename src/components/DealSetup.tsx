import { useState } from 'react';
import type { Deal, MethodKey } from '../types/deal';
import { Check, Field, IntegerInput, MoneyInput, Panel, PercentInput, Segmented, TextInput } from './fields';
import { newCostRow } from '../state/deal';
import { TAX_PRESETS, acquisitionPrice } from '../calculations/taxes';
import { deriveVehicleClass, maxResidual } from '../rates/ally';
import { applyProgramTerm, isProgramSynced } from '../rates/apply';
import { computeComparison, METHOD_LABELS } from '../calculations/comparison';
import { computeTrade } from '../calculations/trade';
import { computeLease } from '../calculations/lease';
import { formatCurrency, formatMoneyCompact } from '../calculations/money';
import BuildUpPanel from './BuildUpPanel';
import RateProgramPanel from './RateProgramPanel';

interface Props {
  deal: Deal;
  onChange: (deal: Deal) => void;
  onPresent: () => void;
  onLoadSample: (which: 'workbook' | 'buyersOrder') => void;
  onReset: () => void;
}

const STRUCTURE_DESCRIPTIONS: Record<MethodKey, string> = {
  cash: 'Paid in full at acquisition. No lender, no payment, no payoff.',
  finance: 'Amortizing loan. The financed balance amortizes to zero.',
  lease: 'Amortizes to a scheduled residual rather than to zero.',
};

const TABS = [
  { key: 'deal', label: 'Deal' },
  { key: 'costs', label: 'Costs & trade' },
  { key: 'tax', label: 'Tax' },
  { key: 'terms', label: 'Terms' },
  { key: 'lender', label: 'Lender' },
  { key: 'review', label: 'Review' },
] as const;

export default function DealSetup({ deal, onChange, onPresent, onLoadSample, onReset }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('deal');
  const set = (patch: Partial<Deal>) => onChange({ ...deal, ...patch });
  const comparison = computeComparison({ ...deal, methods: { cash: true, finance: true, lease: true } });
  const trade = computeTrade(deal);
  const leasePreview = computeLease(deal);
  const anySelected = Object.values(deal.methods).some(Boolean);
  const vehicleClassNote = deriveVehicleClass(deal.rates.condition, deal.rates.modelYear).note;
  const residualCap = maxResidual(deal.lease.termMonths, deal.rates.tier);
  const linked = deal.rates.kind !== 'manual' && deal.rates.linkTerms;
  const synced = isProgramSynced(deal);

  const preview: Record<MethodKey, string> = {
    cash: `${formatMoneyCompact(comparison.cash!.cashRequired)} at acquisition`,
    finance: `${formatCurrency(comparison.finance!.payment)} / mo · ${deal.finance.termMonths} mo`,
    lease: `${formatCurrency(comparison.lease!.payment)} / mo · ${deal.lease.termMonths} mo`,
  };

  return (
    <div className="setup">
      <header className="topbar">
        <div>
          <h1>Commercial Vehicle Acquisition Comparison</h1>
          <div className="sub">Deal setup</div>
        </div>
        <div className="topbar-actions">
          <select
            className="plain"
            style={{ width: 170 }}
            value=""
            onChange={(e) => {
              if (e.target.value) onLoadSample(e.target.value as 'workbook' | 'buyersOrder');
            }}
          >
            <option value="">Load sample deal…</option>
            <option value="workbook">Workbook validation deal</option>
            <option value="buyersOrder">Buyer's order deal</option>
          </select>
          <button className="btn btn-quiet" onClick={onReset}>
            New deal
          </button>
          <button className="btn btn-primary" onClick={onPresent} disabled={!anySelected}>
            Present →
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className="tab" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="setup-body">
        <div className="setup-grid">
          <div className="stack">
            {tab === 'deal' && (
            <Panel title="Deal" hint="Client name and vehicle description are optional">
              <div className="field-grid">
                <Field label="Client / company">
                  <TextInput value={deal.clientName} onChange={(v) => set({ clientName: v })} placeholder="Optional" />
                </Field>
                <Field label="Vehicle description">
                  <TextInput
                    value={deal.vehicleDescription}
                    onChange={(v) => set({ vehicleDescription: v })}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Condition">
                  <Segmented
                    value={deal.rates.condition}
                    options={[
                      { value: 'new' as const, label: 'New' },
                      { value: 'used' as const, label: 'Used' },
                    ]}
                    onChange={(v) => set({ rates: { ...deal.rates, condition: v } })}
                  />
                </Field>
                <Field label="Model year">
                  <IntegerInput
                    value={deal.rates.modelYear}
                    onChange={(v) => set({ rates: { ...deal.rates, modelYear: v } })}
                  />
                </Field>
                <Field label="MSRP">
                  <MoneyInput value={deal.msrp} onChange={(v) => set({ msrp: v })} />
                </Field>
                <Field label="Quantity" hint="identical units">
                  <IntegerInput value={deal.quantity} onChange={(v) => set({ quantity: Math.max(1, v) })} suffix="units" />
                </Field>
                <Field label="Selling price" hint={deal.acquisitionPrice > 0 ? undefined : 'defaults to MSRP'}>
                  <MoneyInput value={deal.acquisitionPrice} onChange={(v) => set({ acquisitionPrice: v })} />
                </Field>
              </div>
              <p className="note" style={{ marginBottom: 0 }}>
                Selling price is what the client actually pays before tax and fees. Leave it blank to use MSRP.
                Condition and model year set the lender rate class — {vehicleClassNote}
              </p>
            </Panel>
            )}

            {tab === 'deal' && (
            <Panel title="Structures to compare" hint="Deselected structures are removed from the presentation">
              <div className="structure-list">
                {(['cash', 'finance', 'lease'] as MethodKey[]).map((key) => (
                  <div key={key} className="structure-toggle" data-key={key} data-on={deal.methods[key]}>
                    <input
                      type="checkbox"
                      checked={deal.methods[key]}
                      onChange={(e) => set({ methods: { ...deal.methods, [key]: e.target.checked } })}
                      aria-label={METHOD_LABELS[key]}
                      style={{ accentColor: '#10263f', width: 15, height: 15 }}
                    />
                    <div>
                      <div className="name">{METHOD_LABELS[key]}</div>
                      <div className="desc">{STRUCTURE_DESCRIPTIONS[key]}</div>
                    </div>
                    <div className="preview-strip">{preview[key]}</div>
                  </div>
                ))}
              </div>
            </Panel>
            )}

            {tab === 'costs' && (
            <Panel title="Additional costs" hint="Upfits, wraps, accessories, service agreements">
              {deal.additionalCosts.length > 0 && (
                <div className="cost-row cost-head">
                  <div>Description</div>
                  <div style={{ textAlign: 'right' }}>Client pays</div>
                  <div style={{ textAlign: 'right' }}>Your cost</div>
                  <div>Taxable</div>
                  <div>Capitalized</div>
                  <div />
                </div>
              )}
              {deal.additionalCosts.length === 0 && (
                <p className="empty-note">No additional costs entered. Add upfit, wrap, delivery or service items here.</p>
              )}
              {deal.additionalCosts.length > 0 && (
                <p className="note" style={{ marginTop: 0 }}>
                  Your cost is what the item cost you, used only for the lender's advance test — upfits are valued at cost,
                  not at retail. Leave it blank to use the client price.
                </p>
              )}
              {deal.additionalCosts.map((cost, i) => (
                <div className="cost-row" key={cost.id}>
                  <TextInput
                    value={cost.description}
                    placeholder="Description"
                    onChange={(v) => {
                      const next = [...deal.additionalCosts];
                      next[i] = { ...cost, description: v };
                      set({ additionalCosts: next });
                    }}
                  />
                  <MoneyInput
                    value={cost.amount}
                    onChange={(v) => {
                      const next = [...deal.additionalCosts];
                      next[i] = { ...cost, amount: v };
                      set({ additionalCosts: next });
                    }}
                  />
                  <MoneyInput
                    value={cost.dealerCost}
                    onChange={(v) => {
                      const next = [...deal.additionalCosts];
                      next[i] = { ...cost, dealerCost: v };
                      set({ additionalCosts: next });
                    }}
                  />
                  <Check
                    checked={cost.taxable}
                    onChange={(v) => {
                      const next = [...deal.additionalCosts];
                      next[i] = { ...cost, taxable: v };
                      set({ additionalCosts: next });
                    }}
                  >
                    Taxable
                  </Check>
                  <Check
                    checked={cost.capitalized}
                    onChange={(v) => {
                      const next = [...deal.additionalCosts];
                      next[i] = { ...cost, capitalized: v };
                      set({ additionalCosts: next });
                    }}
                  >
                    Capitalized
                  </Check>
                  <button
                    className="icon-btn"
                    aria-label="Remove cost"
                    onClick={() => set({ additionalCosts: deal.additionalCosts.filter((c) => c.id !== cost.id) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => set({ additionalCosts: [...deal.additionalCosts, newCostRow()] })}>
                  Add cost
                </button>
              </div>
            </Panel>
            )}

            {tab === 'costs' && (
            <Panel title="Trade-in" hint="Optional">
              <Check checked={deal.trade.enabled} onChange={(v) => set({ trade: { ...deal.trade, enabled: v } })}>
                Include a trade-in
              </Check>
              {deal.trade.enabled && (
                <>
                  <div className="row-divider" />
                  <div className="field-grid three">
                    <Field label="Trade value">
                      <MoneyInput value={deal.trade.value} onChange={(v) => set({ trade: { ...deal.trade, value: v } })} />
                    </Field>
                    <Field label="Trade payoff">
                      <MoneyInput value={deal.trade.payoff} onChange={(v) => set({ trade: { ...deal.trade, payoff: v } })} />
                    </Field>
                    <Field label="Trade equity">
                      <div className="input" style={{ background: '#fbfbfa' }}>
                        <span className={trade.equity < 0 ? 'neg' : 'pos'} style={{ marginLeft: 'auto', fontWeight: 600 }}>
                          {formatCurrency(trade.equity)}
                        </span>
                      </div>
                    </Field>
                  </div>
                  <p className="note" style={{ marginBottom: 0 }}>
                    {trade.equity < 0
                      ? 'Negative equity increases the amount financed or capitalized.'
                      : 'Positive equity reduces the amount financed, capitalized, or paid in cash.'}
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <Check checked={deal.showTradeStep} onChange={(v) => set({ showTradeStep: v })}>
                      Include a trade step in the client presentation
                    </Check>
                  </div>
                </>
              )}
            </Panel>
            )}
          </div>

          <div className="stack">
            {tab === 'tax' && (
            <Panel title="Tax settings" hint="Assumptions you control">
              <div className="field-grid">
                <Field label="Preset">
                  <select
                    className="plain"
                    value={deal.tax.preset}
                    onChange={(e) => {
                      const preset = e.target.value as Deal['tax']['preset'];
                      const found = TAX_PRESETS.find((p) => p.key === preset);
                      set({
                        tax: {
                          ...deal.tax,
                          preset,
                          financeCashRate: found ? found.rate : deal.tax.financeCashRate,
                          leaseRate: found && deal.tax.useSameRate ? found.rate : deal.tax.leaseRate,
                        },
                      });
                    }}
                  >
                    <option value="standard">Standard — 6.25%</option>
                    <option value="mediumDuty">Medium duty — 7.25%</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>
                <Field label="Cash / finance rate">
                  <PercentInput
                    value={deal.tax.financeCashRate}
                    onChange={(v) =>
                      set({
                        tax: {
                          ...deal.tax,
                          preset: 'custom',
                          financeCashRate: v,
                          leaseRate: deal.tax.useSameRate ? v : deal.tax.leaseRate,
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Lease rate">
                  <PercentInput
                    value={deal.tax.useSameRate ? deal.tax.financeCashRate : deal.tax.leaseRate}
                    onChange={(v) => set({ tax: { ...deal.tax, preset: 'custom', leaseRate: v } })}
                  />
                </Field>
                <div className="field" style={{ justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <Check
                    checked={deal.tax.useSameRate}
                    onChange={(v) =>
                      set({ tax: { ...deal.tax, useSameRate: v, leaseRate: v ? deal.tax.financeCashRate : deal.tax.leaseRate } })
                    }
                  >
                    Use the same rate for all structures
                  </Check>
                </div>
              </div>
              <div className="row-divider" />
              <div style={{ display: 'grid', gap: 8 }}>
                <Check
                  checked={deal.tax.tradeReducesTaxableAmount}
                  onChange={(v) => set({ tax: { ...deal.tax, tradeReducesTaxableAmount: v } })}
                >
                  Trade allowance reduces the taxable amount
                </Check>
                <Check checked={deal.tax.feesTaxable} onChange={(v) => set({ tax: { ...deal.tax, feesTaxable: v } })}>
                  Transaction costs are part of the taxable amount
                </Check>
              </div>
              <p className="note" style={{ marginBottom: 0 }}>
                Two rates because a purchase and a lease can be taxed differently on the paperwork. Tick the box below
                to keep them in step.
              </p>
              <p className="note" style={{ marginBottom: 0 }}>
                Tax on {formatCurrency(comparison.finance!.costs.tax.taxableAmount)} ={' '}
                {formatCurrency(comparison.finance!.costs.tax.tax)} for cash and finance
                {deal.tax.useSameRate
                  ? '.'
                  : `; ${formatCurrency(comparison.lease!.costs.tax.tax)} for the lease.`}
              </p>
            </Panel>
            )}

            {tab === 'costs' && (
            <Panel title="Transaction costs" hint="Held in the calculation layer">
              <div className="field-grid three">
                <Field label="Bank fee">
                  <MoneyInput value={deal.fees.bankFee} onChange={(v) => set({ fees: { ...deal.fees, bankFee: v } })} />
                </Field>
                <Field label="Title / license">
                  <MoneyInput value={deal.fees.titleLicense} onChange={(v) => set({ fees: { ...deal.fees, titleLicense: v } })} />
                </Field>
                <Field label="Doc fee">
                  <MoneyInput value={deal.fees.docFee} onChange={(v) => set({ fees: { ...deal.fees, docFee: v } })} />
                </Field>
                <Field label="Inventory tax basis">
                  <Segmented
                    value={deal.fees.inventoryTaxMode}
                    options={[
                      { value: 'amount' as const, label: '$' },
                      { value: 'rate' as const, label: '% of sale' },
                    ]}
                    onChange={(v) => set({ fees: { ...deal.fees, inventoryTaxMode: v } })}
                  />
                </Field>
                {deal.fees.inventoryTaxMode === 'amount' ? (
                  <Field label="Inventory tax">
                    <MoneyInput value={deal.fees.inventoryTax} onChange={(v) => set({ fees: { ...deal.fees, inventoryTax: v } })} />
                  </Field>
                ) : (
                  <Field label="Inventory tax rate">
                    <PercentInput
                      value={deal.fees.inventoryTaxRate}
                      decimals={4}
                      onChange={(v) => set({ fees: { ...deal.fees, inventoryTaxRate: v } })}
                    />
                  </Field>
                )}
                <Field label="Delivery">
                  <MoneyInput value={deal.fees.delivery} onChange={(v) => set({ fees: { ...deal.fees, delivery: v } })} />
                </Field>
                <Field label="GAP insurance">
                  <MoneyInput value={deal.fees.gapInsurance} onChange={(v) => set({ fees: { ...deal.fees, gapInsurance: v } })} />
                </Field>
                <Field label="Service agreement">
                  <MoneyInput
                    value={deal.fees.serviceAgreement}
                    onChange={(v) => set({ fees: { ...deal.fees, serviceAgreement: v } })}
                  />
                </Field>
                <Field label="Facilitator fee">
                  <MoneyInput
                    value={deal.fees.facilitatorFee}
                    onChange={(v) => set({ fees: { ...deal.fees, facilitatorFee: v } })}
                  />
                </Field>
                <Field label="Other">
                  <MoneyInput value={deal.fees.other} onChange={(v) => set({ fees: { ...deal.fees, other: v } })} />
                </Field>
              </div>
              <div className="row-divider" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={() =>
                    set({ fees: { ...deal.fees, bankFee: 695, titleLicense: 245, docFee: 225 } })
                  }
                >
                  Fill usual costs
                </button>
                <span className="note" style={{ margin: 0 }}>
                  Bank fee $695 · license $245 · doc fee $225. Edit any of them afterwards.
                </span>
              </div>
              <div className="row-divider" />
              <Check checked={deal.showTransactionCosts} onChange={(v) => set({ showTransactionCosts: v })}>
                Show detailed transaction costs in the presentation
              </Check>
            </Panel>
            )}

            {tab === 'terms' && (
            <Panel title="Finance terms">
              <div className="field-grid">
                <Field label="Down payment">
                  <MoneyInput
                    value={deal.finance.downPayment}
                    onChange={(v) => set({ finance: { ...deal.finance, downPayment: v } })}
                  />
                </Field>
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
                <Field label="Payment timing">
                  <Segmented
                    value={deal.finance.timing}
                    options={[
                      { value: 'arrears', label: 'Arrears' },
                      { value: 'advance', label: 'Advance' },
                    ]}
                    onChange={(v) => set({ finance: { ...deal.finance, timing: v } })}
                  />
                </Field>
                <Field label="First payment due in">
                  <select
                    className="plain"
                    value={deal.finance.firstPaymentDays}
                    onChange={(e) => set({ finance: { ...deal.finance, firstPaymentDays: Number(e.target.value) } })}
                  >
                    <option value={30}>30 days</option>
                    <option value={45}>45 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </Field>
              </div>
              <p className="note" style={{ marginBottom: 0 }}>
                Arrears means the first payment falls a month after delivery, which is normal for a loan. Advance means
                the first payment is due at signing.
              </p>
              <p className="note" style={{ marginBottom: 0 }}>
                Amount financed {formatCurrency(comparison.finance!.amountFinanced)} · payment{' '}
                {formatCurrency(comparison.finance!.payment)} · total interest{' '}
                {formatCurrency(comparison.finance!.totalInterest)}
                {comparison.finance!.deferredInterest > 0
                  ? ` · includes ${formatCurrency(comparison.finance!.deferredInterest)} of interest capitalized for the deferred first payment`
                  : ''}
              </p>
            </Panel>
            )}

            {tab === 'terms' && (
            <Panel title="Open-end / TRAC lease terms">
              <div className="field-grid">
                <Field label="Initial cash / cap reduction">
                  <MoneyInput value={deal.lease.initialCash} onChange={(v) => set({ lease: { ...deal.lease, initialCash: v } })} />
                </Field>
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
                <Field label="Payment timing">
                  <Segmented
                    value={deal.lease.timing}
                    options={[
                      { value: 'advance', label: 'Advance' },
                      { value: 'arrears', label: 'Arrears' },
                    ]}
                    onChange={(v) => set({ lease: { ...deal.lease, timing: v } })}
                  />
                </Field>
                <Field label="First payment due in">
                  <select
                    className="plain"
                    value={deal.lease.firstPaymentDays}
                    onChange={(e) => set({ lease: { ...deal.lease, firstPaymentDays: Number(e.target.value) } })}
                  >
                    <option value={30}>30 days</option>
                    <option value={45}>45 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </Field>
              </div>
              <div className="row-divider" />
              <div className="field-grid three">
                <Field label="Residual entered as">
                  <Segmented
                    value={deal.lease.residualMode}
                    options={[
                      { value: 'percent', label: '%' },
                      { value: 'amount', label: '$' },
                    ]}
                    onChange={(v) => set({ lease: { ...deal.lease, residualMode: v } })}
                  />
                </Field>
                {deal.lease.residualMode === 'percent' ? (
                  <Field label="Residual percent" hint={`tier ${deal.rates.tier} max ${(residualCap * 100).toFixed(0)}%`}>
                    <PercentInput
                      value={deal.lease.residualPercent}
                      onChange={(v) => set({ lease: { ...deal.lease, residualPercent: v } })}
                    />
                  </Field>
                ) : (
                  <Field label="Residual amount">
                    <MoneyInput
                      value={deal.lease.residualAmount}
                      onChange={(v) => set({ lease: { ...deal.lease, residualAmount: v } })}
                    />
                  </Field>
                )}
                <Field label="Residual basis">
                  <select
                    className="plain"
                    value={deal.lease.residualBasis}
                    onChange={(e) => set({ lease: { ...deal.lease, residualBasis: e.target.value as Deal['lease']['residualBasis'] } })}
                  >
                    <option value="acquisitionPrice">Acquisition price</option>
                    <option value="msrp">MSRP</option>
                    <option value="capitalizedAmount">Capitalized amount</option>
                    <option value="custom">Custom amount</option>
                  </select>
                </Field>
              </div>
              {deal.lease.residualBasis === 'custom' && (
                <div className="field-grid" style={{ marginTop: 12 }}>
                  <Field label="Custom residual basis">
                    <MoneyInput
                      value={deal.lease.residualBasisCustom}
                      onChange={(v) => set({ lease: { ...deal.lease, residualBasisCustom: v } })}
                    />
                  </Field>
                </div>
              )}
              {linked && (
                <p className={synced ? 'note' : 'note warn'} style={{ marginTop: 10, marginBottom: 0 }}>
                  {synced
                    ? `Rate and residual follow the Ally sheet for a ${deal.lease.termMonths} month tier ${deal.rates.tier} deal. Change the term and both update.`
                    : 'Rate or residual has been edited away from the sheet. Use the button below to put it back.'}
                </p>
              )}
              {linked && !synced && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => onChange(applyProgramTerm(deal, deal.lease.termMonths))}>
                    Restore sheet rate and residual
                  </button>
                </div>
              )}
              {deal.rates.kind === 'comtrac' && deal.lease.residualMode === 'percent' && !linked && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn"
                    onClick={() => set({ lease: { ...deal.lease, residualPercent: residualCap } })}
                    disabled={Math.abs(deal.lease.residualPercent - residualCap) < 1e-9}
                  >
                    Use tier {deal.rates.tier} maximum residual — {(residualCap * 100).toFixed(0)}%
                  </button>
                </div>
              )}
              <p className="note" style={{ marginBottom: 0 }}>
                Residual basis {formatCurrency(leasePreview.residualBasis)} · residual{' '}
                {formatCurrency(leasePreview.residualAmount)} · capitalized amount{' '}
                {formatCurrency(leasePreview.capitalizedAmount)} · payment {formatCurrency(leasePreview.payment)}
              </p>
            </Panel>
            )}

            {tab === 'terms' && (
            <Panel title="Comparison assumptions">
              <div className="field-grid">
                <Field label="Estimated vehicle value at comparison date" hint="what it is worth at the end">
                  <MoneyInput
                    value={deal.estimatedVehicleValue}
                    onChange={(v) => set({ estimatedVehicleValue: v })}
                  />
                </Field>
                <Field label="Compare position after">
                  <Segmented
                    value={deal.comparisonMonthMode}
                    options={[
                      { value: 'term', label: 'End of term' },
                      { value: 'custom', label: 'Custom month' },
                    ]}
                    onChange={(v) => set({ comparisonMonthMode: v })}
                  />
                </Field>
                {deal.comparisonMonthMode === 'custom' && (
                  <Field label="Comparison month">
                    <IntegerInput
                      value={deal.comparisonMonth}
                      onChange={(v) => set({ comparisonMonth: Math.max(0, v) })}
                      suffix="mo"
                    />
                  </Field>
                )}
              </div>
              <div className="field-grid" style={{ marginTop: 12 }}>
                <Field label="Next vehicle cost" hint="defaults to this vehicle's price">
                  <MoneyInput value={deal.nextVehiclePrice} onChange={(v) => set({ nextVehiclePrice: v })} />
                </Field>
                <div className="field" style={{ justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <Check checked={deal.showReplacementStep} onChange={(v) => set({ showReplacementStep: v })}>
                    Include the next-vehicle step
                  </Check>
                </div>
              </div>
              {deal.estimatedVehicleValue === 0 && (
                <p className="note warn" style={{ marginBottom: 0 }}>
                  No estimated vehicle value entered. The end-of-term screens will show $0 of value and
                  negative equity for any structure with a remaining payoff.
                </p>
              )}
              <p className="note" style={{ marginBottom: 0 }}>
                Positions are compared at month {computeComparison(deal).comparisonMonth} against an estimated vehicle value
                of {formatCurrency(deal.estimatedVehicleValue, 0)}
                {acquisitionPrice(deal) > 0 && deal.estimatedVehicleValue > 0
                  ? ` (${Math.round((deal.estimatedVehicleValue / acquisitionPrice(deal)) * 100)}% of the acquisition price)`
                  : ''}
                .
              </p>
            </Panel>
            )}

            {tab === 'lender' && (
            <Panel title="Presentation steps" hint="Toggle what the client sees">
              <div style={{ display: 'grid', gap: 9 }}>
                <Check checked={deal.showReplacementStep} onChange={(v) => set({ showReplacementStep: v })}>
                  Next vehicle — what carries forward
                </Check>
                <Check checked={deal.showCycleStep} onChange={(v) => set({ showCycleStep: v })}>
                  Long horizon — across replacement cycles
                </Check>
                {deal.showCycleStep && (
                  <div className="field-grid" style={{ marginTop: 2 }}>
                    <Field label="Number of cycles" hint="how many trucks in a row">
                      <IntegerInput
                        value={deal.cycleCount}
                        onChange={(v) => set({ cycleCount: Math.min(4, Math.max(2, v)) })}
                        suffix="cycles"
                      />
                    </Field>
                  </div>
                )}
                <Check checked={deal.showConsiderationsStep} onChange={(v) => set({ showConsiderationsStep: v })}>
                  Considerations — where each structure fits
                </Check>
              </div>
              <p className="note" style={{ marginBottom: 0 }}>
                Review the long horizon step before showing it. It depends heavily on the replacement cost and future
                value you assume, and it will not always favour the same structure.
              </p>
            </Panel>
            )}

            {tab === 'lender' && <RateProgramPanel deal={deal} onChange={onChange} />}

            {tab === 'review' && <BuildUpPanel deal={deal} />}
          </div>
        </div>
      </div>
    </div>
  );
}
