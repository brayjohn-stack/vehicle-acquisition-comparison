import type { AllyTier, RateProgramKind, VehicleCondition } from '../rates/ally';

export type PaymentTiming = 'arrears' | 'advance';
export type MethodKey = 'cash' | 'finance' | 'lease';

export interface AdditionalCost {
  id: string;
  description: string;
  /** What the client pays for this item. */
  amount: number;
  /**
   * What the item cost the dealer. Used only for the lender's advance test,
   * which values upfits at cost rather than at retail. Zero falls back to amount.
   */
  dealerCost: number;
  taxable: boolean;
  capitalized: boolean;
}

/** Transaction costs. Kept out of the client presentation unless explicitly exposed. */
export interface TransactionFees {
  bankFee: number;
  titleLicense: number;
  docFee: number;
  /** Flat amount, used when inventoryTaxMode is 'amount'. */
  inventoryTax: number;
  /** Rate against the sale price, used when inventoryTaxMode is 'rate' (e.g. 0.001886). */
  inventoryTaxRate: number;
  inventoryTaxMode: 'amount' | 'rate';
  gapInsurance: number;
  delivery: number;
  serviceAgreement: number;
  facilitatorFee: number;
  other: number;
}

export type TaxPreset = 'standard' | 'mediumDuty' | 'custom';

/**
 * Every tax behaviour here is an assumption the operator controls.
 * Nothing in the engine asserts a legally required rate or treatment.
 */
export interface TaxSettings {
  useSameRate: boolean;
  /** decimal, e.g. 0.0625 */
  financeCashRate: number;
  /** decimal, e.g. 0.0625 */
  leaseRate: number;
  preset: TaxPreset;
  /** Assumption: does the trade allowance reduce the taxable amount? */
  tradeReducesTaxableAmount: boolean;
  /** Assumption: are transaction fees part of the taxable amount? */
  feesTaxable: boolean;
}

export interface TradeIn {
  enabled: boolean;
  value: number;
  payoff: number;
}

export interface FinanceTerms {
  downPayment: number;
  /** decimal, e.g. 0.0899 */
  apr: number;
  termMonths: number;
  timing: PaymentTiming;
  /**
   * Days until the first payment. Days beyond 30 accrue interest that is
   * capitalized into the financed amount, matching the buyer's order convention.
   */
  firstPaymentDays: number;
}

export type ResidualBasisMode = 'acquisitionPrice' | 'msrp' | 'capitalizedAmount' | 'custom';

export interface LeaseTerms {
  /** Down payment / initial capital reduction paid at signing. */
  initialCash: number;
  apr: number;
  termMonths: number;
  timing: PaymentTiming;
  residualMode: 'percent' | 'amount';
  /** decimal, e.g. 0.20 */
  residualPercent: number;
  residualAmount: number;
  residualBasis: ResidualBasisMode;
  residualBasisCustom: number;
  firstPaymentDays: number;
}

/** Lender program selections. Never shown in the client presentation. */
export interface RateProgramSettings {
  kind: RateProgramKind;
  tier: AllyTier;
  condition: VehicleCondition;
  modelYear: number;
  federalExempt: boolean;
  directOrEv: boolean;
  municipalOutstandings: number;
  /**
   * Base vehicle only: dealer invoice when new, book wholesale when used.
   * Capitalized upfits are added at cost to derive the EDC/AWV.
   */
  baseVehicleValue: number;
  /** Apply the program rate to the finance column as well as the lease. */
  applyToFinance: boolean;
}

/** Optional, operator-entered. Off by default: no return is assumed unless stated. */
export interface LiquiditySettings {
  enabled: boolean;
  /** Annual return the business expects on capital it retains, as a decimal. */
  reinvestmentRate: number;
}

export interface Deal {
  clientName: string;
  vehicleDescription: string;
  msrp: number;
  /** Falls back to MSRP when left at zero. */
  acquisitionPrice: number;
  additionalCosts: AdditionalCost[];
  fees: TransactionFees;
  tax: TaxSettings;
  trade: TradeIn;
  finance: FinanceTerms;
  lease: LeaseTerms;
  /** Number of identical units in the deal. Per-unit figures are multiplied for fleet totals. */
  quantity: number;
  rates: RateProgramSettings;
  liquidity: LiquiditySettings;
  estimatedVehicleValue: number;
  /** Cost of the replacement vehicle. Falls back to the current acquisition price. */
  nextVehiclePrice: number;
  showReplacementStep: boolean;
  comparisonMonthMode: 'term' | 'custom';
  comparisonMonth: number;
  methods: Record<MethodKey, boolean>;
  showTransactionCosts: boolean;
  showTradeStep: boolean;
  showConsiderationsStep: boolean;
  showCycleStep: boolean;
  /** Number of replacement cycles in the long-horizon step. */
  cycleCount: number;
}
