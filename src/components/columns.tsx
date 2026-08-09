import type { ReactNode } from 'react';
import type { MethodKey } from '../types/deal';
import { formatCurrency } from '../calculations/money';

export const TOOLTIPS = {
  residual:
    'The scheduled balance remaining at the end of an open-end lease. It is not amortized by the monthly payment and remains payable at maturity.',
  capitalized: 'The total amount placed into the lease: vehicle, capitalized additions, tax and transaction costs, less any cash or trade equity applied.',
  equity: 'Estimated vehicle value above any remaining payoff or residual. It is an estimate, not a guaranteed amount.',
  amountFinanced: 'The amount borrowed after any down payment and trade equity are applied.',
} as const;

export function Term({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span className="term" title={tip}>
      {children}
    </span>
  );
}

export function Col({
  mkey,
  title,
  meta,
  children,
}: {
  mkey: MethodKey;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="col" data-key={mkey}>
      <div className="col-title">
        <span className="name">{title}</span>
        {meta ? <span className="meta">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Plate({
  k,
  v,
  op,
  total,
  tone,
}: {
  k: ReactNode;
  v: string;
  op?: string;
  total?: boolean;
  tone?: 'positive' | 'negative' | 'brass';
}) {
  const color = tone === 'positive' ? 'var(--positive)' : tone === 'negative' ? 'var(--negative)' : tone === 'brass' ? 'var(--brass)' : undefined;
  return (
    <div className="ladder-row">
      <span className="op">{op ?? ''}</span>
      <div className={total ? 'plate total' : 'plate'}>
        <span className="k">{k}</span>
        <span className="v" style={color ? { color } : undefined}>
          {v}
        </span>
      </div>
    </div>
  );
}

export function Spec({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="spec">
      <span>{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/** Proportional bar showing how much of the starting balance amortizes. */
export function AmortBar({
  amortized,
  residual = 0,
  deployed = 0,
}: {
  amortized: number;
  residual?: number;
  deployed?: number;
}) {
  const total = amortized + residual + deployed || 1;
  const pct = (v: number) => `${Math.max(0, (v / total) * 100)}%`;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div className="bar">
        {deployed > 0 && <div className="seg-deployed" style={{ width: pct(deployed) }} />}
        {amortized > 0 && <div className="seg-amortized" style={{ width: pct(amortized) }} />}
        {residual > 0 && <div className="seg-residual" style={{ width: pct(residual) }} />}
      </div>
      <div className="bar-key">
        {deployed > 0 && <span className="k-deployed">Deployed at acquisition</span>}
        {amortized > 0 && <span className="k-amortized">Amortized</span>}
        {residual > 0 && <span className="k-residual">Residual at maturity</span>}
      </div>
    </div>
  );
}

export function Equation({
  items,
}: {
  items: { k: string; v: number; op?: string; tone?: 'positive' | 'negative' }[];
}) {
  return (
    <div className="equation">
      {items.map((item, i) => (
        <div key={item.k} style={{ display: 'contents' }}>
          {i > 0 && <span className="eq-op">{item.op ?? '−'}</span>}
          <div className="eq-item">
            <span className="k">{item.k}</span>
            <span
              className="v"
              style={{
                color:
                  item.tone === 'positive' ? 'var(--positive)' : item.tone === 'negative' ? 'var(--negative)' : undefined,
              }}
            >
              {formatCurrency(item.v, 0)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
