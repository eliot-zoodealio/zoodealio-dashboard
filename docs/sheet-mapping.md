# Zoodealio Dashboard — Sheet Mapping Spec

Single source of truth for where every dashboard metric comes from. Keep this file in sync with `api/metrics.js`.

## Source sheets

| Key | Name | Spreadsheet ID |
|---|---|---|
| `JOSEPH` | Joseph - Tracking | `17QTyDys-e4fossUY5PcGNFZtJdrzDrWkzAdrVXiEN9Q` |
| `ESCROWS` | 2026 Escrows and Closings | `1hu6Zd2uAOpiVjBls1tyBHXyM1RAHRw9qMEwnUF_wtAY` |
| `OFFER_REQUESTS` | Zoodealio Offer Request Master Sheet | `19WNHss9kpe9jeMZhd9vX3WrZ3M85-PzRUQIbMl1cJpA` |

## Tabs

- `JOSEPH`: tab name follows an `MM/YYYY` naming convention for each month (e.g. `04/2026`, `05/2026`). Computed dynamically from `DASHBOARD_TIMEZONE` (defaults to `America/Los_Angeles`). Override via `JOSEPH_TAB` env var if needed.
- `ESCROWS`:
  - `acquisitions escrows` — inspection → closing pipeline
  - `listings` — resale pipeline (active / under contract / sold / reno)
  - `closed` — completed acquisition deals (column M deal-type classifier)

## Metric definitions

### 0. Addendums Sent — Acquisition funnel (week + month)

- **Source**: `OFFER_REQUESTS` → `Sent C+ Addendum Acceptances` tab → columns **AD** and **AF** (ranges `AD4:AD` and `AF4:AF`, paired by row)
- **Logic**:
  - **Week** (`addendumsWeek`): count rows where column AD = "Yes" AND column AF is a date in the current **Monday–Friday** business week
  - **Month** (`addendumsMonth`): count rows where column AD = "Yes" AND column AF is a date in the current calendar month
- **Display**: first tile in the pipeline strip (earliest stage of the acquisition funnel). Week is the headline number with "this week" subtitle; month sits as a purple-tinted substat pill at the bottom.
- **Icon**: paper-plane (sent action).
- **Animation**: subtle Zee peek on increase.
- **Note**: data starts at **row 4** (rows 1–2 are totals header, row 3 is the column header row). The tab includes month-divider rows visually, but those don't satisfy the `AD = "Yes" AND AF is a date` predicate so they're filtered out automatically. Collapsed/grouped rows in the sheet UI don't affect the API — Sheets returns the full data range regardless of visibility state.

### 1. New Escrows — Acquisition (week + month)

- **Source**: `JOSEPH`, current month tab (`MM/YYYY`)
  - **Month** (`acceptancesAcq`): direct read of cell **B8** (existing).
  - **Week** (`acceptancesWeek`): open-ended read of columns **A:B**, then sum the values in column B for rows whose column A contains a date in the current **Monday–Friday** business week (Arizona time). Skips header / label rows (Goal, Total, Weekly Perc., Week N) naturally because only rows whose A cell parses as a date contribute.
- **Display**: first tile on the acquisition side. Week is the headline number with "this week" subtitle; month sits as a purple-tinted substat pill at the bottom (`Mo · 31`).
- **Animation**: subtle Zee peek on increase, fires on the **weekly** count.
- **Edge case**: if a Mon-Fri week crosses a month boundary (e.g. Mon Jun 29 – Fri Jul 3), the weekly sum only includes days in the tab we read. The team's convention of putting cross-month rows in the tab named for the week's end-Friday month means the data is usually available in the tab we'd expect. If this becomes an issue, we can extend the API to read both the current and next month tabs.

### 2. Inspection Acquisition

- **Source**: `ESCROWS` → `acquisitions escrows` tab → column A (range `A9:A`)
- **Logic**: count rows where column A has a value AND value is **not** "Cancelled" (case-insensitive)
- **Display**: number, second tile on the acquisition side
- **Meaning**: everything still active in the escrow pipeline, cancelled rows excluded

### 3. Inspection Accepted — Acq

- **Source**: `ESCROWS` → `acquisitions escrows` tab → column A (range `A9:A`)
- **Logic**: count rows where column A = "Closing" OR column A = "Need Funding"
- **Equivalent formula**: `=COUNTIF(A:A,"Closing") + COUNTIF(A:A,"Need Funding")`
- **Display**: number with green checkmark, third tile on the acquisition side

### 4. Projected Closings — Acquisition (week + month)

- **Source**: `ESCROWS` → `acquisitions escrows` tab → column **BL** (range `BL9:BL`)
- **Logic**:
  - **Week**: count rows where column BL is a date in the current **Monday–Friday** business week (Arizona time)
  - **Month**: count rows where column BL is a date in the current calendar month
- **Payload fields**: `projectedClosingsWeek` (big number on tile), `projectedClosingsMonth` (small substat at bottom).
- **Display**: fourth tile on the acquisition side. Week is the headline number with "this week" subtitle; month sits as a purple-tinted substat pill at the bottom of the tile.
- **History**: moved from column BK → BL in May 2026. Week/month split added in June 2026. If the column ever moves again, update the COLUMNS block in `api/metrics.js` (one line) and this doc.

### 5a. Closed — Acquisitions (year-to-date)

- **Source**: `ESCROWS` → `closed` tab → column M (range `M6:M`, open-ended)
- **Logic**: count rows where column M contains "Purchase" (case-insensitive). Matches both `CO+ Purchase` and `Flip Purchase`.
- **Display**: secondary "YTD" number on the acquisition hero card

### 5b. Closed — Acquisitions (this month)

- **Source**: `ESCROWS` → `closed` tab → columns M and S (ranges `M6:M` and `S6:S`, paired by row)
- **Logic**: count rows where column M contains "Purchase" AND column S is a date in the current calendar month
- **Display**: hero number on the left side ("X closings this month")
- **Animation**: full Zee pin-drop celebration on increase

### 6. In Shop / Coming Soon

- **Source**: `ESCROWS` → `listings` tab → column A (range `A10:A`)
- **Logic**: count non-empty rows where column A is **NOT** one of `Active`, `Under Contract`, or `Sold` (case-insensitive). Captures reno, prep, pre-listing, "Coming Soon", and any future intermediate status the team adds without needing a code change.
- **Display**: number, center-bridge tile (between acquisition and resale). Labelled **"In Shop / Coming Soon"** with "in progress" subtitle.
- **Payload field**: `inShopComingSoon` (renamed from `renovationsInProcess` in May 2026).

### 7. Listings — For Sale

- **Source**: `ESCROWS` → `listings` tab → column A (range `A10:A`)
- **Logic**: count rows where column A = "Active"
- **Display**: number, first tile on the resale side

### 8. Under Contract — Resale

- **Source**: `ESCROWS` → `listings` tab → column A (range `A10:A`)
- **Logic**: count rows where column A = "Under Contract"
- **Display**: number with green checkmark, middle tile on the resale side

### 9a. Closed — Resale (year-to-date)

- **Source**: `ESCROWS` → `listings` tab → column A (range `A10:A`)
- **Logic**: count rows where column A = "Sold"
- **Note**: The listings tab is 2026-only, so no year filter is needed.
- **Display**: secondary "YTD" number on the resale hero card

### 9b. Closed — Resale (this month)

- **Source**: `ESCROWS` → `listings` tab → columns A and AS (ranges `A10:A` and `AS10:AS`, paired by row)
- **Logic**: count rows where column A = "Sold" AND column AS is a date in the current calendar month
- **Display**: hero number on the right side ("X resale closings this month")
- **Animation**: full Zee pin-drop celebration on increase

## Composite metrics (computed in the serverless function)

### Total Closings (this month) → goal bar

- Definition: `(5b) + (9b)` = acquisitions closed this month + resale closed this month
- **Goal: 25 per month** (combined across both sides)
- Display: goal bar across the top, `X of 25`, progress fill in Zoodealio green
- Animation: extra Zee swing + confetti when we cross 25

### Total Closings (year-to-date)

- Definition: `(5a) + (9a)`
- Display: supporting text only

## Closing This Week (card at bottom of dashboard)

- **Source**: `ESCROWS` → `closed` tab → columns **A**, **M**, **S** (ranges `A6:A`, `M6:M`, `S6:S`, paired by row)
- **Logic**: collect every row where:
  - Column M contains either `"purchase"` or `"resale"` (case-insensitive — matches `CO+ Purchase`, `C+ Resale`, `Flip Purchase`, etc.)
  - Column S is a date in the current **Monday–Friday** week (Arizona time)
- **Output**: array of `{ address, type, day, dateMs }` sorted by date ascending.
- **Display**: full-width card above the footer. Shows up to 6 entries in a 2-column grid; surfaces a `+N more` badge if more exist. Empty state shows "No closings scheduled this week yet — let's change that."
- **Address column**: A (Property Address on the `closed` tab).
- **Why the closed tab as the single source**: it logs every closed deal (purchase OR resale) — distinguished by column M — and the COE date in column S is what determines what's actually closing. The hero `Closed · Resale` count still reads from `listings`, so if the team enters a Sold date in listings but hasn't logged it in `closed` yet (or vice versa) there can be a brief discrepancy. The card surfaces what's authoritatively closing.

## Refresh cadence

- Browser polls `/api/metrics` every 5 minutes
- Vercel edge caches the response for 4 minutes (`s-maxage=240, stale-while-revalidate=60`)
- Worst-case staleness on the wall display ≈ 5 minutes

## Known assumptions / nits

- `JOSEPH` has one tab per month, named `MM/YYYY` (e.g. `04/2026`). The dashboard computes the current month's tab name automatically. If the tab for a new month hasn't been created yet, the Acceptances metric falls back to `0` rather than failing the whole response — new month → create the tab → numbers light up.
- Month-sensitive logic (which tab to read, which rows count as "this month") uses `DASHBOARD_TIMEZONE` (defaults to `America/Los_Angeles`). Change the env var if you want the dashboard to roll over to a new month on a different timezone's calendar.
- `acquisitions escrows` data starts at **row 9** (rows 1–8 are headers / sheet-level dashboard space).
- `closed` tab data starts at **row 6**.
- `listings` tab data starts at **row 10**.
- "Contains 'purchase'" substring match is case-insensitive and matches any cell with the word — including future deal-type variants.
- All ranges use open-ended notation (e.g. `A9:A`, `A10:A`) so the formulas keep working as the sheets grow.
