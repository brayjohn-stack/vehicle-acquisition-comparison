import { useEffect, useMemo, useState } from 'react';
import type { Deal } from '../types/deal';
import { computeComparison } from '../calculations/comparison';
import {
  StepAcquisition,
  StepAmortization,
  StepCashDeployed,
  StepMonthly,
  StepPosition,
  StepSummary,
  StepConsiderations,
  StepCycles,
  StepReplacement,
  StepTrade,
  type StepProps,
} from './steps';
import ScenarioBar from './ScenarioBar';
import QuickAdjust from './QuickAdjust';

interface StepDefinition {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  /** Steps that depend on the future-value assumption get the live scenario bar. */
  scenario?: boolean;
  render: (props: StepProps) => JSX.Element;
}

interface Props {
  deal: Deal;
  step: number;
  onStepChange: (step: number) => void;
  onDealChange: (deal: Deal) => void;
  onEdit: () => void;
}

export default function Presentation({ deal, step, onStepChange, onDealChange, onEdit }: Props) {
  const result = useMemo(() => computeComparison(deal), [deal]);
  const month = result.comparisonMonth;
  const [adjusting, setAdjusting] = useState(false);

  const steps: StepDefinition[] = useMemo(() => {
    const list: StepDefinition[] = [
      {
        id: 'acquisition',
        eyebrow: 'Acquisition',
        title: 'How are we acquiring the vehicle?',
        intro: 'The same vehicle and the same total cost, considered under each structure.',
        render: (p) => <StepAcquisition {...p} />,
      },
    ];

    if (deal.trade.enabled && deal.showTradeStep) {
      list.push({
        id: 'trade',
        eyebrow: 'Trade position',
        title: 'Where does the current vehicle stand?',
        render: (p) => <StepTrade {...p} />,
      });
    }

    list.push(
      {
        id: 'amortization',
        eyebrow: 'Structure',
        title: 'What actually gets amortized?',
        intro: 'Finance amortizes the balance to zero. An open-end lease amortizes only down to the residual.',
        render: (p) => <StepAmortization {...p} />,
      },
      {
        id: 'monthly',
        eyebrow: 'Monthly requirement',
        title: 'What is the monthly cash requirement?',
        render: (p) => <StepMonthly {...p} />,
      },
      {
        id: 'deployed',
        eyebrow: 'Liquidity',
        title: `Cumulative scheduled cash outflow through month ${month}`,
        intro: 'Cash deployed measures liquidity, not economic cost. Asset value is addressed separately.',
        render: (p) => <StepCashDeployed {...p} />,
      },
      {
        id: 'position',
        eyebrow: 'Position',
        title: `Where does each structure stand at month ${month}?`,
        intro: 'Estimated equity is vehicle value above any remaining payoff or residual.',
        scenario: true,
        render: (p) => <StepPosition {...p} />,
      },
    );

    if (deal.showReplacementStep) {
      list.push({
        id: 'replacement',
        eyebrow: 'Next vehicle',
        title: 'What happens when it is time for the next vehicle?',
        intro: 'What each structure leaves available to put toward the replacement.',
        scenario: true,
        render: (p) => <StepReplacement {...p} />,
      });
    }

    if (deal.showCycleStep) {
      list.push({
        id: 'cycles',
        eyebrow: 'Long horizon',
        title: `Across ${Math.max(2, deal.cycleCount)} replacement cycles`,
        intro: 'Equity from each cycle is applied to the next, on the same terms throughout.',
        render: (p) => <StepCycles {...p} />,
      });
    }

    list.push({
      id: 'summary',
      eyebrow: 'Summary',
      title: 'Side-by-side comparison',
      scenario: true,
      render: (p) => <StepSummary {...p} />,
    });

    if (deal.showConsiderationsStep) {
      list.push({
        id: 'considerations',
        eyebrow: 'Considerations',
        title: 'Which structure fits the business?',
        intro: 'The trade is between total cost and cash flow. Neither is universally right.',
        render: (p) => <StepConsiderations {...p} />,
      });
    }

    return list;
  }, [
    deal.trade.enabled,
    deal.showTradeStep,
    deal.showReplacementStep,
    deal.showCycleStep,
    deal.showConsiderationsStep,
    deal.cycleCount,
    month,
  ]);

  const index = Math.min(Math.max(step, 0), steps.length - 1);
  const current = steps[index];

  useEffect(() => {
    if (index !== step) onStepChange(index);
  }, [index, step, onStepChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        onStepChange(Math.min(index + 1, steps.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        onStepChange(Math.max(index - 1, 0));
      } else if (e.key === 'Escape') {
        if (adjusting) setAdjusting(false);
        else onEdit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, steps.length, onStepChange, onEdit, adjusting]);

  return (
    <div className="stage">
      <header className="stage-head">
        <div>
          <div className="client">{deal.clientName || 'Vehicle acquisition comparison'}</div>
          <div className="vehicle">
            {deal.vehicleDescription ? `${deal.vehicleDescription} · ` : ''}
            {[
              deal.methods.finance ? `Finance ${deal.finance.termMonths} mo` : null,
              deal.methods.lease ? `Lease ${deal.lease.termMonths} mo` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {' · compared at month '}
            {month}
          </div>
        </div>
        <div className="right">
          <div className="chip-row">
            {result.methods.map((m) => (
              <span className="chip" key={m.key} data-key={m.key}>
                {m.key === 'lease' ? 'Open-End / TRAC Lease' : m.label}
              </span>
            ))}
          </div>
          <button className="btn" onClick={() => setAdjusting(true)}>
            Adjust
          </button>
          <button className="btn btn-quiet" onClick={onEdit}>
            Edit deal
          </button>
        </div>
      </header>

      <main className="stage-body">
        <div className="stage-inner">
          <div className="step-head">
            <div className="eyebrow">{current.eyebrow}</div>
            <h2>{current.title}</h2>
            {current.intro ? <p className="note">{current.intro}</p> : null}
          </div>
          <div className="step-content" key={current.id}>
            {current.render({ deal, result })}
            {current.scenario && <ScenarioBar deal={deal} result={result} onChange={onDealChange} />}
          </div>
        </div>
      </main>

      <footer className="stage-foot">
        <div className="dots">
          {steps.map((s, i) => (
            <button
              key={s.id}
              className="dot"
              aria-current={i === index}
              aria-label={`Go to ${s.title}`}
              onClick={() => onStepChange(i)}
            />
          ))}
        </div>
        <span className="counter">
          {index + 1} / {steps.length}
        </span>
        <p className="disclaimer">
          Illustrative comparison only. Actual rates, taxes, fees, approvals, vehicle values and financing terms may vary.
          Estimated future vehicle value is an assumption and is not guaranteed.
        </p>
        <div className="nav-actions">
          <button className="btn" onClick={() => onStepChange(Math.max(index - 1, 0))} disabled={index === 0}>
            Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onStepChange(Math.min(index + 1, steps.length - 1))}
            disabled={index === steps.length - 1}
          >
            Next
          </button>
        </div>
      </footer>

      {adjusting && <QuickAdjust deal={deal} onChange={onDealChange} onClose={() => setAdjusting(false)} />}
    </div>
  );
}
