# WealthTrack ◈

A self-hosted, mobile-first **GBP personal finance tracker**. No bank access, cloud account, advertising, analytics or paid APIs. Built with native HTML, CSS and JavaScript.

## Features

- Separate bank accounts, cash ISAs, investment account cash, physical cash, and liabilities
- Double-entry transfers between accounts and manually logged income and expenses
- Monthly budget limits, category analysis, and six-month cashflow charts
- Investment holdings with fractional units, per-unit cost, manual GBP price and unrealised gain
- Savings goals without double-counting them as assets
- User-confirmed demo data, validated JSON export/restore, transactions CSV export
- Mobile-first layout, optional light mode, installable/offline PWA

## Run locally

```bash
python3 -m http.server 8000 --directory site
```

Open http://localhost:8000. To test: `npm run verify` (requires Node.js 22).

## Publish with GitHub Pages

Create a **separate public repository** called `wealthtrack`, upload these files to its root, and in **Settings → Pages** select **Source: GitHub Actions**. The committed workflow tests and publishes the `site/` directory. Expected URL for the `Empyrios` GitHub username: `https://empyrios.github.io/wealthtrack/`.

The app is fully offline-capable after its first successful load, excluding optional Google Fonts.

## Financial and privacy model

All balances and transaction amounts are **GBP integer pence**, while fractional investment quantities are stored as millionths of a share. Transfers move money between accounts and do not affect income or expenditure totals. Investments are shown as **cash plus holdings at manually entered prices**, so **only put uninvested cash** in an investment account's opening balance. A liability is recorded as a negative balance. Savings goal progress is separate from asset valuation.

**Important:** `localStorage` is NOT encrypted and browser profile data can be cleared. Do not enter bank account numbers, credentials, identity numbers or private employer information. Export backups regularly and keep them off GitHub. GitHub Pages project subdirectories under `empyrios.github.io` share a browser origin, so other same-origin scripts are not isolated. For real sensitive financial records, host on a dedicated origin/custom domain and consider client-side encryption or an authenticated backend. No data is fetched from your actual bank or broker. No market prices are fetched. The app is not a substitute for official financial statements or investment advice.

## Limitations

- No cloud sync, login, real-time prices, FX conversions, bank connections or tax calculations.
- Holdings are manual position snapshots, not an execution ledger. Adjusting a holding doesn't automatically debit/credit cash.
- Budgets are category-based monthly defaults; historic month-specific overrides are not part of v1.
- No automated recurring transactions or notifications.
- Backups are plain JSON. Import replaces the current local state after confirmation.
- Local browser storage is subject to browser quotas and deletion. Export backups regularly.

## Roadmap

1. Optional encrypted private storage and dedicated hosting origin
2. Proper trade journal, cost-basis lots, cash reconciliation, market quotes (consented sources)
3. Goals linked to accounts with reservation-aware (not additive) progress
4. Recurring transactions, statement import and cashflow forecasts
5. Optional end-to-end-encrypted multi-device sync
