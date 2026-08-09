import type { Deal, MethodKey } from '../types/deal';
import type { ComparisonResult, MethodComparison } from '../calculations/comparison';
import { formatCurrency, formatMoneyCompact, formatPercent } from '../calculations/money';
import { AmortBar, Col, Equation, Plate, Spec, Term, TOOLTIPS } from './columns';
import { projectCycles } from '../calculations/cycles';

export interface StepProps {
  deal: Deal;
  result: ComparisonResult;
}

/**
 * The single most common client question, answered factually. A lease at the same
 * rate does accrue more finance charge; the reason is mechanical, not a markup.
 */
export const INTEREST_EXPLAINER =
  'At the same rate, a lease accrues more finance charge than a loan. A loan amortizes the balance to zero, so the interest charged each month shrinks as the balance falls. A lease amortizes only down to the residual, so interest continues to be charged on that residual balance for every month of the term. Lower payment, higher total finance charge — the trade is cash flow, not cost.';

const SHORT_LABEL: Record<MethodKey, string> = {
  cash: 'Cash',
  finance: 'Finance',
  lease: 'Open-End Lease',
};

function Columns({ result, children }: { result: ComparisonResult; children: React.ReactNode }) {
  return (
    <div className="columns" data-count={result.activeMethods.length}>
      {children}
    </div>
  );
}

function termsMeta(m: MethodComparison): string | undefined {
  if (m.termMonths === null || m.apr === null) return undefined;
  return `${m.termMonths} mo · ${formatPercent(m.apr)} APR`;
}

/* ---------------- Step 1 — acquisition ---------------- */

export function StepAcquisition({ deal, result }: StepProps) {
  const costs = (result.finance ?? result.lease ?? result.cash)!.costs;
  return (
    <>
      <div className="headline-plate">
        <div>
          <span className="label">Vehicle / project cost</span>
          <div className="figure-lg" style={{ marginTop: 8 }}>
            {formatMoneyCompact(costs.totalProjectCost)}
          </div>
          {deal.vehicleDescription ? (
            <div className="note" style={{ marginTop: 8 }}>
              {deal.vehicleDescription}
            </div>
          ) : null}
        </div>
        <div className="breakdown">
          <div>
            <span className="k">Acquisition price</span>
            <span className="v">{formatMoneyCompact(costs.acquisitionPrice)}</span>
          </div>
          {costs.capitalizedAdditions > 0 && (
            <div>
              <span className="k">Additions</span>
              <span className="v">{formatMoneyCompact(costs.capitalizedAdditions + costs.nonCapitalizedAdditions)}</span>
            </div>
          )}
          <div>
            <span className="k">Tax</span>
            <span className="v">{formatMoneyCompact(costs.tax.tax)}</span>
          </div>
          {deal.showTransactionCosts && costs.fees > 0 && (
            <div>
              <span className="k">Transaction costs</span>
              <span className="v">{formatMoneyCompact(costs.fees)}</span>
            </div>
          )}
        </div>
      </div>

      <Columns result={result}>
        {result.methods.map((m) => (
          <Col key={m.key} mkey={m.key} title={SHORT_LABEL[m.key]} meta={termsMeta(m)}>
            <p className="note" style={{ margin: 0 }}>
              {m.key === 'cash' && 'The full acquisition cost is deployed at closing. No lender, no monthly payment, no payoff.'}
              {m.key === 'finance' && 'A conventional amortizing loan. The financed balance amortizes to a scheduled $0 at maturity.'}
              {m.key === 'lease' && (
                <>
                  An open-end / TRAC lease. Payments amortize the capitalized amount down to a scheduled{' '}
                  <Term tip={TOOLTIPS.residual}>residual</Term>, not to zero.
                </>
              )}
            </p>
          </Col>
        ))}
      </Columns>
    </>
  );
}

/* ---------------- Trade step ---------------- */

export function StepTrade({ result }: StepProps) {
  const { trade } = result;
  const base = (result.finance ?? result.lease ?? result.cash)!.costs.totalProjectCost;
  return (
    <>
      <Equation
        items={[
          { k: 'Current vehicle value', v: trade.value },
          { k: 'Payoff', v: trade.payoff },
          {
            k: 'Trade equity',
            v: trade.equity,
            op: '=',
            tone: trade.equity < 0 ? 'negative' : 'positive',
          },
        ]}
      />
      <div className="strip">
        <div className="amount">{formatMoneyCompact(Math.max(0, base - trade.equity))}</div>
        <div className="text">
          {trade.equity >= 0 ? (
            <>
              Vehicle and project cost of {formatMoneyCompact(base)} less {formatMoneyCompact(trade.equity)} of trade equity
              leaves this as the remaining acquisition amount to be paid, financed or capitalized.
            </>
          ) : (
            <>
              The payoff exceeds the trade value by {formatMoneyCompact(Math.abs(trade.equity))}. That shortfall is added to the
              vehicle and project cost of {formatMoneyCompact(base)}, increasing the amount to be paid, financed or capitalized.
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- Step 2 — what gets amortized ---------------- */

export function StepAmortization({ result }: StepProps) {
  const { finance, lease, cash } = result;
  return (
    <Columns result={result}>
      {cash && (
        <Col mkey="cash" title="Cash">
          <div className="ladder">
            <Plate k="Cash deployed at acquisition" v={formatMoneyCompact(cash.cashRequired)} />
            <Plate k="Amount financed" v="$0" op="↓" />
            <Plate k="Scheduled balance at any point" v="$0" op="↓" total />
          </div>
          <AmortBar amortized={0} deployed={cash.cashRequired} />
          <p className="note" style={{ margin: 0 }}>
            Nothing amortizes. The cost is deployed once at acquisition and the asset is owned outright.
          </p>
        </Col>
      )}

      {finance && (
        <Col mkey="finance" title="Finance">
          <div className="ladder">
            <Plate k={<Term tip={TOOLTIPS.amountFinanced}>Amount financed</Term>} v={formatMoneyCompact(finance.amountFinanced)} />
            <Plate k="Amortized during the term" v={formatMoneyCompact(finance.amountFinanced)} op="↓" />
            <Plate k="Scheduled ending balance" v="$0" op="↓" total />
          </div>
          <AmortBar amortized={finance.amountFinanced} />
          <p className="note" style={{ margin: 0 }}>
            Finance amortizes the financed balance toward zero over {finance.termMonths} months.
          </p>
        </Col>
      )}

      {lease && (
        <Col mkey="lease" title="Open-End / TRAC Lease">
          <div className="ladder">
            <Plate
              k={<Term tip={TOOLTIPS.capitalized}>Capitalized amount</Term>}
              v={formatMoneyCompact(lease.capitalizedAmount)}
            />
            <Plate
              k={
                <>
                  <Term tip={TOOLTIPS.residual}>Residual</Term> at {formatPercent(lease.residualPercent, 1)} of{' '}
                  {formatMoneyCompact(lease.residualBasis)}
                </>
              }
              v={formatMoneyCompact(lease.residualAmount)}
              op="−"
              tone="brass"
            />
            <Plate k="Amortized during the lease" v={formatMoneyCompact(lease.amountAmortized)} op="=" total />
          </div>
          <AmortBar amortized={lease.amountAmortized} residual={lease.residualAmount} />
          <p className="note" style={{ margin: 0 }}>
            The lease amortizes toward the residual rather than toward zero.{' '}
            {formatMoneyCompact(lease.residualAmount)} remains scheduled at month {lease.termMonths} and must be satisfied at
            lease end.
          </p>
        </Col>
      )}
    </Columns>
  );
}

/* ---------------- Step 3 — monthly cash requirement ---------------- */

export function StepMonthly({ deal, result }: StepProps) {
  const diff = result.liquidity.monthlyDifference;
  const advance = [
    result.finance && result.finance.timing === 'advance' ? 'finance' : null,
    result.lease && result.lease.timing === 'advance' ? 'lease' : null,
  ].filter(Boolean) as string[];
  const firstPaymentDays: Record<string, number> = {
    finance: deal.finance.firstPaymentDays,
    lease: deal.lease.firstPaymentDays,
    cash: 0,
  };
  const advanceNote =
    advance.length > 0
      ? `Payments on the ${advance.join(' and ')} are due in advance, so the first payment is due at signing and is included in initial cash.`
      : null;
  return (
    <>
      <Columns result={result}>
        {result.methods.map((m) => (
          <Col key={m.key} mkey={m.key} title={SHORT_LABEL[m.key]}>
            <div className="stat">
              <span className="label">{m.key === 'cash' ? 'Upfront cash deployed' : 'Monthly payment'}</span>
              <span className="figure">
                {m.key === 'cash' ? formatMoneyCompact(m.initialCash) : formatCurrency(m.monthlyPayment ?? 0)}
              </span>
            </div>
            <div>
              {m.key === 'cash' ? (
                <>
                  <Spec k="Monthly payment" v="None" />
                  <Spec k="Finance charge" v="None" />
                  <Spec k="Payoff at any point" v="$0" />
                </>
              ) : (
                <>
                  <Spec k="Term" v={`${m.termMonths} months`} />
                  <Spec k="APR" v={formatPercent(m.apr ?? 0)} />
                  {m.key === 'lease' && (
                    <Spec
                      k={<Term tip={TOOLTIPS.residual}>Residual at maturity</Term>}
                      v={`${formatMoneyCompact(m.scheduledEndingBalance ?? 0)} · ${formatPercent(m.residualPercent ?? 0, 1)}`}
                    />
                  )}
                  {m.key === 'finance' && <Spec k="Scheduled balance at maturity" v="$0" />}
                  {firstPaymentDays[m.key] > 30 && (
                    <Spec k="First payment due" v={`${firstPaymentDays[m.key]} days from delivery`} />
                  )}
                  <Spec
                    k="Initial cash"
                    v={formatCurrency(m.initialCash)}
                  />
                </>
              )}
            </div>
          </Col>
        ))}
      </Columns>

      {result.quantity > 1 && (
        <div className="strip" style={{ borderLeftColor: 'var(--brass)' }}>
          <div className="amount">
            {formatCurrency(
              result.methods.reduce((sum, x) => sum + (x.monthlyPayment ?? 0), 0) === 0
                ? 0
                : (result.methods.find((x) => x.monthlyPayment !== null)?.monthlyPayment ?? 0) * result.quantity,
            )}
          </div>
          <div className="text">
            Across {result.quantity} units the fleet monthly requirement is{' '}
            {result.methods
              .filter((x) => x.monthlyPayment !== null)
              .map((x) => `${SHORT_LABEL[x.key]} ${formatCurrency((x.monthlyPayment ?? 0) * result.quantity)}`)
              .join(' and ')}
            .
          </div>
        </div>
      )}

      {advanceNote && (
        <p className="note" style={{ margin: 0 }}>
          {advanceNote}
        </p>
      )}

      {diff !== null && result.finance && result.lease && (
        <div className="strip">
          <div className="amount">{formatCurrency(Math.abs(diff))}</div>
          <div className="text">
            Difference in the scheduled monthly payment. The lease payment amortizes{' '}
            {formatMoneyCompact(result.lease.amountAmortized)} rather than the full{' '}
            {formatMoneyCompact(result.finance.amountFinanced)}, because {formatMoneyCompact(result.lease.residualAmount)}{' '}
            remains as a residual at month {deal.lease.termMonths}.
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Step 4 — cash deployed during the term ---------------- */

export function StepCashDeployed({ result }: StepProps) {
  const month = result.comparisonMonth;
  const liquidity = result.liquidity.initialLiquidityRetained;
  return (
    <>
      <Columns result={result}>
        {result.methods.map((m) => {
          const payments = m.monthlyPayment === null ? 0 : m.cumulativeCash - m.initialCash;
          return (
            <Col key={m.key} mkey={m.key} title={SHORT_LABEL[m.key]}>
              <div>
                <Spec k="Initial cash at acquisition" v={formatCurrency(m.initialCash)} />
                {m.monthlyPayment !== null && (
                  <Spec
                    k={`Scheduled payments after acquisition through month ${month}`}
                    v={formatCurrency(payments)}
                  />
                )}
                {m.monthlyPayment === null && <Spec k="Scheduled payments" v="None" />}
              </div>
              <div className="stat">
                <span className="label">Cumulative scheduled cash outflow</span>
                <span className="figure">{formatMoneyCompact(m.cumulativeCash)}</span>
              </div>
            </Col>
          );
        })}
      </Columns>

      {result.quantity > 1 && (
        <p className="note" style={{ margin: 0 }}>
          Across {result.quantity} units, cumulative scheduled outflow through month {month} is{' '}
          {result.methods.map((x) => `${SHORT_LABEL[x.key]} ${formatCurrency(x.cumulativeCash * result.quantity, 0)}`).join(', ')}.
        </p>
      )}

      {liquidity && liquidity.amount > 0 ? (
        <div className="strip">
          <div className="amount">{formatMoneyCompact(liquidity.amount)}</div>
          <div className="text">
            Initial liquidity retained at acquisition under {liquidity.versus === 'finance' ? 'finance' : 'the lease'} compared
            with a cash purchase. That amount is repaid over the term through the scheduled payments shown above.
          </div>
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>
          Cumulative scheduled cash outflow through month {month}. Cash deployed is a liquidity measure, not economic cost —
          the vehicle retains value, which is addressed on the next screen.
        </p>
      )}
    </>
  );
}

/* ---------------- Step 5 — end-of-term position ---------------- */

export function StepPosition({ result }: StepProps) {
  const month = result.comparisonMonth;
  return (
    <>
      <Columns result={result}>
        {result.methods.map((m) => (
          <Col key={m.key} mkey={m.key} title={SHORT_LABEL[m.key]}>
            <div className="ladder">
              <Plate k="Estimated vehicle value" v={formatMoneyCompact(m.estimatedVehicleValue)} />
              <Plate
                k={
                  m.key === 'lease' ? (
                    <>
                      Remaining <Term tip={TOOLTIPS.residual}>residual</Term> / payoff
                    </>
                  ) : m.key === 'finance' ? (
                    'Remaining loan payoff'
                  ) : (
                    'Debt / payoff'
                  )
                }
                v={formatMoneyCompact(m.payoffAtComparison)}
                op="−"
                tone={m.payoffAtComparison > 0 ? 'brass' : undefined}
              />
              <Plate
                k={<Term tip={TOOLTIPS.equity}>Estimated equity</Term>}
                v={formatMoneyCompact(m.estimatedEquity)}
                op="="
                total
                tone={m.estimatedEquity < 0 ? 'negative' : 'positive'}
              />
            </div>
            <p className="note" style={{ margin: 0 }}>
              {m.key === 'cash' && 'No lien exists, so estimated equity is the full estimated vehicle value.'}
              {m.key === 'finance' &&
                (m.payoffAtComparison > 0
                  ? `The loan has not matured at month ${month}; the remaining payoff is deducted from vehicle value.`
                  : 'The scheduled balance is zero at maturity, so estimated equity is the full estimated vehicle value.')}
              {m.key === 'lease' &&
                `The residual must be satisfied before any value accrues to the lessee. Estimated equity is vehicle value above the remaining payoff.`}
            </p>
          </Col>
        ))}
      </Columns>
      {result.methods.some((m) => m.estimatedEquity < 0) && (
        <div className="strip" style={{ borderLeftColor: 'var(--negative)' }}>
          <div className="amount neg">
            {formatMoneyCompact(Math.min(...result.methods.map((m) => m.estimatedEquity)))}
          </div>
          <div className="text">
            At an estimated vehicle value of {formatMoneyCompact(result.estimatedVehicleValue)} in month {month}, the estimated
            value is below the remaining payoff. The shortfall would be payable rather than realized as equity.
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Replacement — getting into the next vehicle ---------------- */

export function StepReplacement({ result }: StepProps) {
  const next = result.nextVehiclePrice;
  return (
    <>
      <Columns result={result}>
        {result.methods.map((m) => {
          const shortfall = m.estimatedEquity < 0;
          const applied = Math.max(0, m.estimatedEquity);
          return (
            <Col key={m.key} mkey={m.key} title={SHORT_LABEL[m.key]}>
              <div className="ladder">
                <Plate k="Next vehicle cost" v={formatMoneyCompact(next)} />
                <Plate
                  k={shortfall ? 'Amount due at termination' : 'Equity applied from current vehicle'}
                  v={formatMoneyCompact(Math.abs(m.estimatedEquity))}
                  op={shortfall ? '+' : '−'}
                  tone={shortfall ? 'negative' : 'positive'}
                />
                <Plate
                  k="Remaining to finance, lease or pay"
                  v={formatMoneyCompact(next - applied + (shortfall ? Math.abs(m.estimatedEquity) : 0))}
                  op="="
                  total
                />
              </div>
              <p className="note" style={{ margin: 0 }}>
                {shortfall
                  ? `Estimated value is below the remaining payoff, so ${formatMoneyCompact(
                      Math.abs(m.estimatedEquity),
                    )} is payable at termination and there is no equity to apply.`
                  : m.key === 'lease'
                    ? 'The residual is satisfied first; only value above it carries forward.'
                    : 'No payoff remains, so the full estimated value carries forward.'}
              </p>
            </Col>
          );
        })}
      </Columns>
      <p className="note" style={{ margin: 0 }}>
        Equity shown is the estimated amount available toward the replacement vehicle after any remaining payoff or
        residual is satisfied. Next vehicle cost is an assumption and excludes tax and fees on that transaction.
      </p>
    </>
  );
}

/* ---------------- Replacement cycles — the long horizon ---------------- */

export function StepCycles({ deal, result }: StepProps) {
  const cycles = Math.max(2, deal.cycleCount);
  const projections = result.methods.map((m) => projectCycles(deal, m.key, cycles));
  const years = Math.round((projections[0]?.totalMonths ?? 0) / 12);

  return (
    <>
      <table className="summary-table">
        <thead>
          <tr>
            <th className="metric">Across {cycles} cycles — roughly {years} years</th>
            {result.methods.map((x) => (
              <th key={x.key} data-key={x.key}>
                {SHORT_LABEL[x.key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cycles }, (_, i) => (
            <tr key={i} className={i === 0 ? undefined : 'group-start'}>
              <td className="metric">
                Cycle {i + 1} — monthly payment, cash outflow
              </td>
              {projections.map((p) => (
                <td key={p.key}>
                  {p.legs[i].monthlyPayment === null ? '—' : formatCurrency(p.legs[i].monthlyPayment ?? 0)}
                  <span className="muted"> · {formatCurrency(p.legs[i].cashOutflow, 0)}</span>
                </td>
              ))}
            </tr>
          ))}
          <tr className="group-start">
            <td className="metric">Total cash outflow</td>
            {projections.map((p) => (
              <td key={p.key}>{formatCurrency(p.totalCashOutflow, 0)}</td>
            ))}
          </tr>
          <tr>
            <td className="metric">Equity held at the end</td>
            {projections.map((p) => (
              <td key={p.key} className={p.finalEquity < 0 ? 'neg' : 'pos'}>
                {formatCurrency(p.finalEquity, 0)}
              </td>
            ))}
          </tr>
          <tr className="emphasis">
            <td className="metric">Net cost across the horizon</td>
            {projections.map((p) => (
              <td key={p.key}>{formatCurrency(p.netCost, 0)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="table-legend">
        Each cycle assumes the same term, rate and structure, with equity from one cycle applied to the next and any
        shortfall paid at termination. Replacement cost and future values are assumptions, and small changes to them move
        these totals substantially.
      </p>
    </>
  );
}

/* ---------------- Considerations ---------------- */

export function StepConsiderations({ result }: StepProps) {
  const lease = result.lease;
  const finance = result.finance;
  return (
    <>
      <div className="columns" data-count={result.activeMethods.length >= 2 ? 2 : 1}>
        <div className="col" data-key="finance">
          <div className="col-title">
            <span className="name">Where finance tends to fit</span>
          </div>
          <ul className="consider">
            <li>The balance amortizes to zero, so the asset is owned outright at maturity.</li>
            <li>Lower total finance charge at the same rate, because nothing is left accruing interest.</li>
            <li>Full estimated value carries into the next vehicle rather than only the amount above a residual.</li>
            <li>Suits a business holding cash reserves that intends to keep the vehicle well past the term.</li>
            {finance && <li>Requires {formatCurrency(finance.payment)} per month against the lease alternative.</li>}
          </ul>
        </div>
        <div className="col" data-key="lease">
          <div className="col-title">
            <span className="name">Where an open-end lease tends to fit</span>
          </div>
          <ul className="consider">
            <li>Lower monthly requirement, because only the amount above the residual amortizes.</li>
            <li>Less capital committed at acquisition, leaving working capital in the business.</li>
            <li>Advance limits can allow more of the upfit and soft costs to be carried in the transaction.</li>
            <li>Suits a business expanding quickly where monthly overhead governs what contracts it can take.</li>
            {lease && (
              <li>
                Leaves {formatMoneyCompact(lease.residualAmount)} payable at maturity, satisfied by sale, payoff,
                refinance or return.
              </li>
            )}
          </ul>
        </div>
      </div>

      {lease && (
        <div className="strip">
          <div className="amount">{formatMoneyCompact(lease.residualAmount)}</div>
          <div className="text">
            Exit paths at month {lease.termMonths}: sell the vehicle and settle the residual from proceeds; pay the
            residual and own it; refinance the remaining balance; or return it under the terms of the agreement. The
            outcome depends on the vehicle's value at that date.
          </div>
        </div>
      )}

      <p className="note" style={{ margin: 0 }}>
        Tax treatment, deductibility and balance sheet presentation depend on the client's circumstances and should be
        confirmed with their CPA. Nothing here is tax or accounting advice.
      </p>
    </>
  );
}

/* ---------------- Step 6 — comparison summary ---------------- */

export function StepSummary({ deal, result }: StepProps) {
  const month = result.comparisonMonth;
  const m = result.methods;
  const retained = result.liquidity.retainedValue;
  const dash = '—';

  /**
   * Marks the lower cash figure or the higher equity figure in a row. It is a
   * factual comparison of that row only — never an overall recommendation.
   */
  const favored = (values: (number | null)[], direction: 'low' | 'high'): number => {
    const usable = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
    if (usable.length < 2) return -1;
    const best = usable.reduce((a, b) => (direction === 'low' ? (b.v < a.v ? b : a) : b.v > a.v ? b : a));
    if (usable.filter((x) => x.v === best.v).length > 1) return -1;
    return best.i;
  };

  const cell = (fn: (x: MethodComparison) => string) => m.map((x) => <td key={x.key}>{fn(x)}</td>);

  const marked = (
    pick: (x: MethodComparison) => number | null,
    format: (x: MethodComparison) => string,
    direction: 'low' | 'high',
  ) => {
    const idx = favored(m.map(pick), direction);
    return m.map((x, i) => (
      <td key={x.key} data-favor={i === idx ? 'true' : undefined}>
        {format(x)}
      </td>
    ));
  };

  return (
    <>
      <table className="summary-table">
        <thead>
          <tr>
            <th className="metric">Position at month {month}</th>
            {m.map((x) => (
              <th key={x.key} data-key={x.key}>
                {SHORT_LABEL[x.key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="metric">Initial cash required</td>
            {marked((x) => x.initialCash, (x) => formatCurrency(x.initialCash, 0), 'low')}
          </tr>
          <tr>
            <td className="metric">Monthly payment</td>
            {marked(
              (x) => x.monthlyPayment,
              (x) => (x.monthlyPayment === null ? dash : formatCurrency(x.monthlyPayment)),
              'low',
            )}
          </tr>
          <tr>
            <td className="metric">Term / APR</td>
            {cell((x) => (x.termMonths === null ? dash : `${x.termMonths} mo · ${formatPercent(x.apr ?? 0)}`))}
          </tr>
          <tr className="group-start">
            <td className="metric">Starting balance</td>
            {cell((x) => (x.startingBalance === null ? dash : formatCurrency(x.startingBalance, 0)))}
          </tr>
          <tr>
            <td className="metric">Amount amortized through month {month}</td>
            {cell((x) => (x.amountAmortized === null ? dash : formatCurrency(x.amountAmortized, 0)))}
          </tr>
          <tr>
            <td className="metric">Scheduled ending balance / residual</td>
            {cell((x) => (x.scheduledEndingBalance === null ? dash : formatCurrency(x.scheduledEndingBalance, 0)))}
          </tr>
          <tr>
            <td className="metric">
              <Term tip={INTEREST_EXPLAINER}>Total interest / finance charge</Term>
            </td>
            {cell((x) => (x.totalInterest === null ? dash : formatCurrency(x.totalInterest, 0)))}
          </tr>
          <tr className="group-start">
            <td className="metric">Cumulative scheduled cash outflow</td>
            {marked((x) => x.cumulativeCash, (x) => formatCurrency(x.cumulativeCash, 0), 'low')}
          </tr>
          <tr>
            <td className="metric">Estimated vehicle value</td>
            {cell((x) => formatCurrency(x.estimatedVehicleValue, 0))}
          </tr>
          <tr>
            <td className="metric">Remaining payoff / residual</td>
            {cell((x) => formatCurrency(x.payoffAtComparison, 0))}
          </tr>
          <tr className="emphasis">
            <td className="metric">Estimated equity toward the next vehicle</td>
            {(() => {
              const idx = favored(m.map((x) => x.estimatedEquity), 'high');
              return m.map((x, i) => (
                <td key={x.key} className={x.estimatedEquity < 0 ? 'neg' : 'pos'} data-favor={i === idx ? 'true' : undefined}>
                  {formatCurrency(x.estimatedEquity, 0)}
                </td>
              ));
            })()}
          </tr>
          <tr className="emphasis">
            <td className="metric">
              <Term tip="Cumulative scheduled cash outflow less estimated equity at the comparison date. It measures what the period cost net of what is still held, and ignores the time value of money and any tax treatment.">
                Net cost over the period
              </Term>
            </td>
            {marked((x) => x.netCostOfUse, (x) => formatCurrency(x.netCostOfUse, 0), 'low')}
          </tr>
          {retained && (
            <tr>
              <td className="metric">
                <Term tip="A stated assumption, not a projection: the cash a structure does not require, compounded at the rate entered in setup.">
                  Value of retained liquidity at {formatPercent(deal.liquidity.reinvestmentRate)}
                </Term>
              </td>
              {marked(
                (x) => retained[x.key] ?? 0,
                (x) => formatCurrency(retained[x.key] ?? 0, 0),
                'high',
              )}
            </tr>
          )}
          {deal.showTransactionCosts && (
            <tr className="group-start">
              <td className="metric">Transaction costs included</td>
              {cell(() => formatCurrency((result.finance ?? result.lease ?? result.cash)!.costs.fees, 0))}
            </tr>
          )}
        </tbody>
      </table>

      {result.quantity > 1 && (
        <p className="table-legend">
          Figures are per unit. Across {result.quantity} units the fleet monthly requirement is{' '}
          {result.methods
            .filter((x) => x.monthlyPayment !== null)
            .map((x) => `${SHORT_LABEL[x.key]} ${formatCurrency((x.monthlyPayment ?? 0) * result.quantity)}`)
            .join(', ')}
          , and net cost over the period totals{' '}
          {result.methods.map((x) => `${SHORT_LABEL[x.key]} ${formatCurrency(x.netCostOfUse * result.quantity, 0)}`).join(', ')}.
        </p>
      )}

      <p className="table-legend">
        A marker indicates the lower cash figure or the higher equity figure in that row only. It is not a
        recommendation, and no structure is best on every row.
      </p>

      <div className="takeaways">
        {result.takeaways.map((t, i) => (
          <div className="takeaway" key={i}>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </>
  );
}
