import type { AdditionalCost, Deal } from '../types/deal';

const STORAGE_KEY = 'vehicle-acquisition-comparison:deal:v1';

export function newCostRow(partial: Partial<AdditionalCost> = {}): AdditionalCost {
  return {
    id: Math.random().toString(36).slice(2, 10),
    description: '',
    amount: 0,
    dealerCost: 0,
    taxable: true,
    capitalized: true,
    ...partial,
  };
}

export function createEmptyDeal(): Deal {
  return {
    clientName: '',
    vehicleDescription: '',
    msrp: 0,
    acquisitionPrice: 0,
    additionalCosts: [],
    fees: {
      bankFee: 0,
      titleLicense: 0,
      docFee: 0,
      inventoryTax: 0,
      inventoryTaxRate: 0,
      inventoryTaxMode: 'amount',
      gapInsurance: 0,
      delivery: 0,
      serviceAgreement: 0,
      facilitatorFee: 0,
      other: 0,
    },
    tax: {
      useSameRate: true,
      financeCashRate: 0.0625,
      leaseRate: 0.0625,
      preset: 'standard',
      // Both source buyer's orders compute tax on the sale price net of the
      // trade allowance, so this defaults on. It remains an editable assumption.
      tradeReducesTaxableAmount: true,
      feesTaxable: false,
    },
    trade: { enabled: false, value: 0, payoff: 0 },
    finance: { downPayment: 0, apr: 0.0899, termMonths: 60, timing: 'arrears', firstPaymentDays: 30 },
    lease: {
      initialCash: 0,
      apr: 0.0899,
      termMonths: 60,
      timing: 'advance',
      residualMode: 'percent',
      residualPercent: 0.2,
      residualAmount: 0,
      residualBasis: 'acquisitionPrice',
      residualBasisCustom: 0,
      firstPaymentDays: 30,
    },
    quantity: 1,
    rates: {
      kind: 'comtrac',
      tier: 'A',
      condition: 'new',
      modelYear: new Date().getFullYear(),
      federalExempt: false,
      directOrEv: false,
      municipalOutstandings: 0,
      baseVehicleValue: 0,
      applyToFinance: false,
      linkTerms: true,
    },
    liquidity: { enabled: false, reinvestmentRate: 0 },
    estimatedVehicleValue: 0,
    nextVehiclePrice: 0,
    showReplacementStep: true,
    comparisonMonthMode: 'term',
    comparisonMonth: 60,
    methods: { cash: false, finance: true, lease: true },
    showTransactionCosts: false,
    showTradeStep: true,
    showConsiderationsStep: true,
    showCycleStep: false,
    cycleCount: 2,
  };
}

/** Workbook validation Case C, used for the sample deal. */
export function createSampleDeal(): Deal {
  const deal = createEmptyDeal();
  return {
    ...deal,
    clientName: 'Sample Fleet Client',
    vehicleDescription: '2026 Medium-Duty Cab & Chassis with Service Body',
    msrp: 62500,
    acquisitionPrice: 60125,
    fees: { ...deal.fees, bankFee: 695, titleLicense: 470 },
    rates: { ...deal.rates, kind: 'manual' },
    finance: { ...deal.finance, apr: 0.0899, termMonths: 60, timing: 'arrears', downPayment: 0 },
    lease: { ...deal.lease, apr: 0.0899, termMonths: 60, timing: 'advance', residualPercent: 0.2 },
    estimatedVehicleValue: 20000,
    methods: { cash: true, finance: true, lease: true },
  };
}

/**
 * Sample built from the lease buyer's order: 2026 Hino L6 with a 28ft box,
 * lift gate and ramp. No customer information is included.
 */
export function createBuyersOrderSampleDeal(): Deal {
  const deal = createEmptyDeal();
  return {
    ...deal,
    clientName: '',
    vehicleDescription: '2026 Hino L6 — 28ft box, lift gate and ramp',
    msrp: 93900,
    acquisitionPrice: 87000,
    additionalCosts: [newCostRow({ description: "28ft box, lift gate and ramp", amount: 6900, taxable: true, capitalized: true })],
    tax: { ...deal.tax, preset: 'mediumDuty', financeCashRate: 0.0725, leaseRate: 0.0725 },
    fees: {
      ...deal.fees,
      titleLicense: 245,
      docFee: 225,
      serviceAgreement: 895,
      bankFee: 695,
      inventoryTaxMode: 'rate',
      inventoryTaxRate: 0.001886,
    },
    finance: { ...deal.finance, apr: 0.0899, termMonths: 60, timing: 'arrears', firstPaymentDays: 45 },
    lease: { ...deal.lease, apr: 0.0899, termMonths: 60, timing: 'advance', residualPercent: 0.2 },
    estimatedVehicleValue: 28000,
    methods: { cash: false, finance: true, lease: true },
  };
}

/** Deep-merges stored values over the current defaults so older saves stay loadable. */
function reconcile(stored: unknown): Deal {
  const base = createEmptyDeal();
  if (!stored || typeof stored !== 'object') return base;
  const s = stored as Record<string, any>;
  return {
    ...base,
    ...s,
    fees: { ...base.fees, ...(s.fees ?? {}) },
    tax: { ...base.tax, ...(s.tax ?? {}) },
    trade: { ...base.trade, ...(s.trade ?? {}) },
    finance: { ...base.finance, ...(s.finance ?? {}) },
    lease: { ...base.lease, ...(s.lease ?? {}) },
    methods: { ...base.methods, ...(s.methods ?? {}) },
    rates: { ...base.rates, ...(s.rates ?? {}) },
    liquidity: { ...base.liquidity, ...(s.liquidity ?? {}) },
    additionalCosts: Array.isArray(s.additionalCosts)
      ? s.additionalCosts.map((c: Partial<AdditionalCost>) => newCostRow(c))
      : [],
  };
}

export function loadDeal(): Deal | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return reconcile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDeal(deal: Deal): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deal));
  } catch {
    /* storage unavailable; the deal simply is not persisted */
  }
}

export function clearDeal(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
