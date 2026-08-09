# Commercial Vehicle Acquisition Comparison

A presentation tool for comparing **cash purchase**, **conventional finance**, and **open-end / TRAC lease**
economics side by side with a business owner.

Two views: a **deal setup** view where every assumption is entered once, and a **client presentation**
view that reveals the economics one step at a time. All three structures calculate in the background;
deselected structures are removed from the presentation entirely.

## Running it

```bash
npm install
npm run dev      # local development
npm run test     # calculation tests (no DOM required)
npm run build    # static build to dist/ — deployable to GitHub Pages or any static host
```

Vite is configured with `base: './'`, so `dist/` can be served from any subpath.

## Architecture

The calculation engine is independent of React and independently testable.

```
src/calculations/
  money.ts          rounding + display formatting
  amortization.ts   shared level-payment engine with balloon/residual support
  taxes.ts          tax assumptions and the capitalized cost build-up
  trade.ts          trade equity
  cash.ts           cash acquisition
  finance.ts        conventional amortizing loan
  lease.ts          open-end / TRAC lease
  comparison.ts     assembly, liquidity figures, neutral takeaway generation
src/types/deal.ts   the single deal shape
src/state/deal.ts   defaults, sample deal, localStorage persistence
src/components/     DealSetup, Presentation, steps, columns, fields
tests/              engine tests including the workbook validation cases
```

## Financial model

**Finance** — standard amortizing loan. `Pmt = PV·r / (1 − (1+r)^−n)`, or `PV / n` at 0% APR.
The schedule amortizes to a scheduled balance of $0; remaining payoff is read from the schedule at
any comparison month.

**Open-end / TRAC lease** — an amortizing obligation with a terminal residual:

```
Arrears:  Pmt = (PV − FV/(1+r)^n) · r / (1 − (1+r)^−n)
Advance:  Pmt = Arrears / (1 + r)
0% APR:   Pmt = (PV − FV) / n
```

The schedule amortizes down to the residual, not to zero. The residual remains payable at maturity.
Residual is calculated against a configurable **residual basis** (acquisition price by default), not
against the gross capitalized amount.

**Precision** — intermediate values are never rounded. Payments are rounded to cents as a contract
would state them, and the final scheduled payment is solved so the schedule reconciles exactly to $0
(finance) or to the residual (lease) with no cumulative penny drift.

**Neutrality** — cash is not treated as pure economic expense simply because capital left the bank;
the lease residual is never ignored; and payment differences are reported as differences in scheduled
cash outflow, never as "savings."

## Source document reconciliation

The engine is checked against three independent sources, all in `tests/documents.test.ts`.

**TValue Online** — a $154,967.40 loan at 7.840% nominal, 60 monthly payments in advance, produces
$3,110.0084. TValue shows $3,110.01. The engine matches to the cent, which is the strongest available
confirmation of the advance-payment convention.

**Lease buyer's order** — $87,000 base plus $6,900 of options = $93,900 sale price, taxed at 7.25%
= $6,807.75; license $245 + doc fee $225 = $470; vehicle service agreement $895; vehicle inventory
tax at 0.1886% of sale price = $177.10.

**Finance buyer's order** — $73,000 sale price taxed at 7.25% = $5,292.50; license $185.50 + doc fee
$225 = $410.50; inventory tax $118.99; service agreement $895; bank fee $695; balance $80,411.99.

Two conventions were adopted from these documents:

- **Trade allowance reduces the taxable amount.** Both forms compute tax on the sale price net of
  the trade allowance and then add the payoff back as a separate line. This now defaults on, and
  remains editable.
- **Deferred first payment.** The worksheets compute "Monthly Payment @ 45 days" by capitalizing
  `amount × APR / 24` — 15 extra days of interest on a 360-day basis. The engine generalizes this to
  `amount × APR × (days − 30) / 360` and reproduces the worksheet's $1,772.7259839731 exactly.

### Discrepancies found in the source workbooks

Flagged rather than replicated:

1. **The Loan Calculator's monthly amortization table is arrears-style while its payment is
   advance-style.** Interest is charged on the full beginning balance without first deducting the
   payment, so the balances run high — the 36-month case shows $52,723.98 at month 12 where the
   correct advance figure is $52,586.00. The workbook's own annual table agrees with $52,586.00, so
   the two tables inside the sheet disagree with each other.
2. **"Total Interest Paid over Loan Term" is negative.** It subtracts the loan amount without adding
   the balloon back, reporting −$12,031.67 where the true figure is $12,018.33.
3. **The Form tab and the Loan Calculator tab use different tax rates** — 7.25% on the form, 6.25%
   on the calculator, with different inventory tax rates (0.163% vs 0.1886%). This is exactly why
   the rate is an input here rather than a constant.

This tool computes the advance-payment schedule correctly throughout, so remaining payoff before
maturity will read lower than the old sheet's monthly table. That difference is expected.

## Validation cases

Base: $60,125 vehicle · 6.25% tax ($3,757.8125) · $695 bank fee · $470 title/license ·
gross $65,047.8125 · 8.99% APR · payments in advance.

| Case | Term | Residual | Residual $ | Expected payment |
| ---- | ---- | -------- | ---------- | ---------------- |
| A | 36 | 40% | $24,050.00 | $1,472.67 |
| B | 48 | 30% | $18,037.50 | $1,295.06 |
| C | 60 | 20% | $12,025.00 | $1,181.64 |
| D | 60 | 25% | $15,031.25 | $1,142.07 |
| E | 48 | 20% | $12,025.00 | $1,398.83 |

All five reproduce exactly (`npm run test`). Case C computes $1,181.643868 before rounding.

## Lender programs

`src/rates/ally.ts` holds the Ally Commercial Services Group ComTRAC and Municipal
Lease Purchase rate sheet, effective August 4, 2026:

- ComTRAC rates by vehicle class (New / CSU 2027–2025 / 2024), term band and tier S–C
- Maximum residual by term year and tier
- Maximum advance as a share of EDC/AWV, split at $80,000
- Municipal rates by outstandings band and term, with the 100% / 95% advance cap
- Dealer participation minimums and the 2.50% / 2.00% DFI ceilings
- The 0.75 point federal exempt loading, the $5,000 minimum, and the direct
  ComTRAC / EV floor of 20% residual at 60 months maximum

The sheet is marked "For Dealer Use Only; NOT for Distribution to Consumers", so
none of it renders in the client presentation. It fills the operator's rate and
residual assumptions and flags deals outside program limits, quantifying the cash
needed to bring an over-advanced deal back inside the cap.

Rates change. Update the tables in `src/rates/ally.ts` and change
`RATE_SHEET_EFFECTIVE`, which is displayed in the setup panel so a stale sheet is
visible rather than silent.

## Assumptions the operator controls

Nothing about tax treatment is hard-coded as a rule. Rates, whether cash/finance and lease share a
rate, whether the trade allowance reduces the taxable amount, whether transaction costs are taxable,
whether each additional cost is taxable and/or capitalized, residual basis, payment timing, and the
estimated future vehicle value are all inputs.

## Storage

The current deal is persisted to `localStorage` under `vehicle-acquisition-comparison:deal:v1`.
`loadDeal`/`saveDeal`/`clearDeal` in `src/state/deal.ts` are the only storage touchpoints, so a
server-backed store can replace them later without touching the calculation or presentation layers.

## Keyboard

`→` / `Space` next · `←` back · `Esc` return to deal setup.

## Cost build-up

The setup view includes a **Cost build-up** panel that lists the deal in buyer's order sequence —
sale price, options, trade allowance, inventory tax, sales tax, fees, payoff, down payment, and the
resulting amount financed, capitalized or paid in cash — so every figure can be checked against the
paperwork before presenting.
