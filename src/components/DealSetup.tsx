import type { Deal, MethodKey } from '../types/deal';
import { Check, Field, IntegerInput, MoneyInput, Panel, PercentInput, Segmented, TextInput } from './fields';
import { newCostRow } from '../state/deal';
import { TAX_PRESETS, acquisitionPrice } from '../calculations/taxes';
import { computeComparison, METHOD_LABELS } from '../calculations/comparison';
import { computeTrade } from '../calculations/trade';
import { computeLease } from '../calculations/lease';
import { formatCurrency, formatMoneyCompact } from '../calculations/money';
import BuildUpPanel from './BuildUpPanel';

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

export default function DealSetup({ deal, onChange, onPresent, onLoadSample, onReset }: Props) {
  const set = (patch: Partial<Deal>) => onChange({ ...deal, ...patch });
  const comparison = computeComparison({ ...deal, methods: { cash: true, finance: true, lease: true } });
  const trade = computeTrade(deal);
  const leasePreview = computeLease(deal);
  const anySelected = Object.values(deal.methods).some(Boolean);

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

      <div className="setup-body">
        <div className="setup-grid">
          <div className="stack">
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
                <Field label="MSRP">
                  <MoneyInput value={deal.msrp} onChange={(v) => set({ msrp: v })} />
                </Field>
                <Field label="Acquisition price" hint={deal.acquisitionPrice > 0 ? undefined : 'defaults to MSRP'}>
                  <MoneyInput value={deal.acquisitionPrice} onChange={(v) => set({ acquisitionPrice: v })} />
                </Field>
              </div>
            </Panel>

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

            <Panel title="Additional costs" hint="Upfits, wraps, accessories, service agreements">
              {deal.additionalCosts.length > 0 && (
                <div className="cost-row cost-head">
                  <div>Description</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                  <div>Taxable</div>
                  <div>Capitalized</div>
                  <div />
                </div>
              )}
              {deal.additionalCosts.length === 0 && (
                <p className="empty-note">No additional costs entered. Add upfit, wrap, delivery or service items here.</p>
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
          </div>

          <div className="stack">
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
                Tax on {formatCurrency(comparison.finance!.costs.tax.taxableAmount)} ={' '}
                {formatCurrency(comparison.finance!.costs.tax.tax)} for cash and finance
                {deal.tax.useSameRate
                  ? '.'
                  : `; ${formatCurrency(comparison.lease!.costs.tax.tax)} for the lease.`}
              </p>
            </Panel>

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
                Amount financed {formatCurrency(comparison.finance!.amountFinanced)} · payment{' '}
                {formatCurrency(comparison.finance!.payment)} · total interest{' '}
                {formatCurrency(comparison.finance!.totalInterest)}
                {comparison.finance!.deferredInterest > 0
                  ? ` · includes ${formatCurrency(comparison.finance!.deferredInterest)} of interest capitalized for the deferred first payment`
                  : ''}
              </p>
            </Panel>

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
                    onChange={(v) => set({ lease: { ...deal.lease, termMonths: Math.max(1, v) } })}
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
                  <Field label="Residual percent">
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
              <p className="note" style={{ marginBottom: 0 }}>
                Residual basis {formatCurrency(leasePreview.residualBasis)} · residual{' '}
                {formatCurrency(leasePreview.residualAmount)} · capitalized amount{' '}
                {formatCurrency(leasePreview.capitalizedAmount)} · payment {formatCurrency(leasePreview.payment)}
              </p>
            </Panel>

            <Panel title="Comparison assumptions">
              <div className="field-grid">
                <Field label="Estimated vehicle value at comparison date">
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

            <BuildUpPanel deal={deal} />
          </div>
        </div>
      </div>
    </div>
  );
}
