import { useEffect, useState } from 'react';
import type { Deal } from './types/deal';
import { clearDeal, createBuyersOrderSampleDeal, createEmptyDeal, createSampleDeal, loadDeal, saveDeal } from './state/deal';
import DealSetup from './components/DealSetup';
import Presentation from './components/Presentation';

type View = 'setup' | 'present';

export default function App() {
  const [deal, setDeal] = useState<Deal>(() => loadDeal() ?? createEmptyDeal());
  const [view, setView] = useState<View>('setup');
  const [step, setStep] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  // The deal survives refreshes and moving between setup and presentation.
  useEffect(() => {
    saveDeal(deal);
  }, [deal]);

  return (
    <div className="app">
      {view === 'setup' ? (
        <DealSetup
          deal={deal}
          onChange={setDeal}
          onPresent={() => setView('present')}
          onLoadSample={(which) => setDeal(which === 'workbook' ? createSampleDeal() : createBuyersOrderSampleDeal())}
          onReset={() => setConfirmReset(true)}
        />
      ) : (
        <Presentation deal={deal} step={step} onStepChange={setStep} onEdit={() => setView('setup')} />
      )}

      {confirmReset && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmReset(false)}
        >
          <div className="modal">
            <h3>Start a new deal?</h3>
            <p className="note" style={{ margin: 0 }}>
              This clears every input in the current deal, including saved values in this browser. It cannot be undone.
            </p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Keep current deal
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  clearDeal();
                  setDeal(createEmptyDeal());
                  setStep(0);
                  setConfirmReset(false);
                }}
              >
                Clear and start over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
