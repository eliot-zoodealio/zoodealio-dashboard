# Zoodealio Dashboard — Sheet Mapping Spec

Single source of truth for where every dashboard metric comes from. Keep this file in sync with `api/metrics.js`.

## Source sheets

| Key | Name | Spreadsheet ID |
|---|---|---|
| `JOSEPH` | Joseph - Tracking | `17QTyDys-e4fossUY5PcGNFZtJdrzDrWkzAdrVXiEN9Q` |
| `ESCROWS` | 2026 Escrows and Closings | `1hu6Zd2uAOpiVjBls1tyBHXyM1RAHRw9qMEwnUF_wtAY` |

## Tabs

- `JOSEPH`: tab name follows an `MM/YYYY` naming convention for each month (e.g. `04/2026`, `05/2026`). Computed dynamically from `DASHBOARD_TIMEZONE` (defaults to `America/Los_Angeles`). Override via `JOSEPH_TAB` env var if needed.
- `ESCROWS`:
  - `acquisitions escrows` — inspection → closing pipeline
  - `listings` — resale pipeline (active / under contract / sold / reno)
  - `closed` — completed acquisition deals (column M deal-type classifier)

## Metric definitions

### 1. Acceptances — Acquisition

- **Source**: `JOSEPH`, cell `B8`
- **Logic**: direct read
- **Display**: number, first tile on the acquisition side
- **Animation**: subtle Zee peek on increase

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

### 4. Projected Closings — Acquisition (month)

- **Source**: `ESCROWS` → `acquisitions escrows` tab → column BK (range `BK9:BK`)
- **Logic**: count rows where column BK is a date in the current calendar month
- **Display**: number, fourth tile on the acquisition side

### 5a. Closed — Acquisitions (year-to-date)

- **Source**: `ESCROWS` → `closed` tab → column M (range `M6:M`, open-ended)
- **Logic**: count rows where column M contains "Purchase" (case-insensitive). Matches both `CO+ Purchase` and `Flip Purchase`.
- **Display**: secondary "YTD" number on the acquisition hero card

### 5b. Closed — Acquisitions (this month)

- **Source**: `ESCROWS` → `closed` tab → columns M and S (ranges `M6:M` and `S6:S`, paired by row)
- **Logic**: count rows where column M contains "Purchase" AND column S is a date in the current calendar month
- **Display**: hero number on the left side ("X closings this month")
- **Animation**: full Zee pin-drop celebration on increase

### 6. Renovations in Process

- **Source**: `ESCROWS` → `listings` tab → column A (range `A10:A`)
- **Logic**: count rows where column A = "Reno In Process"
- **Display**: number, center-bridge tile (between acquisition and resale)

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
- **Goal: 30 per month** (combined across both sides)
- Display: goal bar across the top, `X of 30`, progress fill in Zoodealio green
- Animation: extra Zee swing + confetti when we cross 30

### Total Closings (year-to-date)

- Definition: `(5a) + (9a)`
- Display: supporting text only

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
