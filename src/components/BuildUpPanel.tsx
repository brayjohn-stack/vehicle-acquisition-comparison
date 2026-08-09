import { useState } from 'react';
import type { Deal, MethodKey } from '../types/deal';
import { buildUpLines } from '../calculations/taxes';
import { formatCurrency } from '../calculations/money';
import { Panel, Segmented } from './fields';

const LABELS: Record<MethodKey, string> = { cash: 'Cash', finance: 'Finance', lease: 'Lease' };

/**
 * Mirrors the order of operations on the buyer's order so every figure can be
 * checked against the paperwork before the deal is presented.
 */
export default function BuildUpPanel({ deal }: { deal: Deal }) {
  const active = (['finance', 'lease', 'cash'] as MethodKey[]).filter((k) => deal.methods[k]);
  const [method, setMethod] = useState<MethodKey>(active[0] ?? 'finance');
  const shown = active.includes(method) ? method : (active[0] ?? 'finance');
  const reduction = shown === 'finance' ? deal.finance.downPayment : shown === 'lease' ? deal.lease.initialCash : 0;
  const lines = buildUpLines(deal, shown, reduction);

  return (
    <Panel title="Cost build-up" hint="Ties to the buyer's order">
      {active.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={shown}
            options={active.map((k) => ({ value: k, label: LABELS[k] }))}
            onChange={setMethod}
          />
        </div>
      )}
      <div className="buildup">
        {lines.map((line, i) => (
          <div className={`buildup-row ${line.kind}`} key={`${line.label}-${i}`}>
            <span>{line.label}</span>
            <span className={line.kind === 'credit' ? 'muted' : undefined}>{formatCurrency(line.amount)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
