# Zoodealio Office Dashboard — Project Context

This file is the **single source of truth for ramping up a new Claude session**. Read this first. It captures everything you need to know to make safe changes without re-deriving from the chat history.

---

## What this is

A landscape 16:9 office dashboard that runs full-screen on a **65" TV** in the Zoodealio office. Shows live real-estate pipeline metrics pulled from three Google Sheets. Hosted on Vercel at **zoodealio-dashboard.vercel.app**.

**Owner**: Eliot Tomaszewski (eliot@zoodealio.com), in Arizona (America/Phoenix, no DST).

## Tech stack

- **Hosting**: Vercel (free tier, well within limits)
- **Backend**: Vercel serverless function (`api/metrics.js`) — single endpoint that aggregates Google Sheets data
- **Frontend**: Vanilla JS + Inter font (`public/app.js`, `public/index.html`, `public/styles.css`)
- **Auth**: Service account (`zoodealio-dashboard-reader@heroic-mechanic-494322-m9.iam.gserviceaccount.com`)
- **Repo**: GitHub `eliot-zoodealio/zoodealio-dashboard`, deploys on push to `main`
- **Workflow**: Eliot edits from terminal at `~/Dev/zoodealio-dashboard`. Claude (when connected via Cowork) edits files directly; Eliot runs `git add -A && git commit -m "..." && git push`. Vercel auto-deploys in ~30s.

## File map

```
api/metrics.js              ← the serverless function — aggregates 3 sheets into one JSON response
public/index.html           ← dashboard markup
public/app.js               ← fetch loop, render, animations, theme switcher
public/styles.css           ← all styling, CSS variables for both light + dark themes
public/assets/              ← logo + custom icons + Zee mascot
docs/sheet-mapping.md       ← detailed source-to-metric mapping (kept in sync with metrics.js)
.env.example                ← env var docs for setup
```

## Data sources — three Google Sheets

| Key | Name | Spreadsheet ID |
|---|---|---|
| `JOSEPH` | Joseph - Tracking | `17QTyDys-e4fossUY5PcGNFZtJdrzDrWkzAdrVXiEN9Q` |
| `ESCROWS` | 2026 Escrows and Closings | `1hu6Zd2uAOpiVjBls1tyBHXyM1RAHRw9qMEwnUF_wtAY` |
| `OFFER_REQUESTS` | Zoodealio Offer Request Master Sheet | `19WNHss9kpe9jeMZhd9vX3WrZ3M85-PzRUQIbMl1cJpA` |

All three are shared with the service account email as **Viewer**.

### Column mapping (lives in `COLUMNS` block at top of `api/metrics.js` — that's the source of truth)

**Joseph - Tracking** (current month tab, named `MM/YYYY` like `06/2026`):
- `B8` — monthly New Escrows total
- `A:B` — daily rows (column A = date, column B = daily count)
- Used for: New Escrows tile (week reads from daily rows, month reads from B8)

**2026 Escrows and Closings → `acquisition escrows` tab** (data starts row 9):
- `A` — status (Cancelled / Closing / Need Funding / etc.)
- `B` — property address
- `BL` — projected close date *(moved from BK → BL in May 2026)*

**2026 Escrows and Closings → `closed` tab** (data starts row 6):
- `M` — deal type ("CO+ Purchase", "C+ Resale", "Flip Purchase", etc.)
- `S` — close-of-escrow date

**2026 Escrows and Closings → `listings` tab** (data starts row 10):
- `A` — status ("Active", "Under Contract", "Sold", "Reno In Process", "Coming Soon", etc.)
- `B` — property address
- `AT` — resale close date
- `AS` — deprecated (was old sold-date column; no longer used)

**Offer Request Master Sheet → `Sent C+ Addendum Acceptances` tab** (data starts row 4):
- `AD` — "Cash+ addendum Sent Out?" (Yes/No)
- `AF` — Date C+ Addendum Sent

## Dashboard layout (top to bottom)

```
┌──────────────────────────────────────────────────────────────┐
│ Topbar: Zoodealio logo + LIVE pill + clock + next-update     │
├──────────────────────────────────────────────────────────────┤
│ HERO ROW: Closed Acquisitions  |  Closed Resale              │
├──────────────────────────────────────────────────────────────┤
│ THE PIPELINE label                                           │
├──────────────────────────────────────────────────────────────┤
│ Pipeline strip — 8 tiles:                                    │
│  Addendums Sent | New Escrows | Acq. UC | Insp. Accepted |   │
│  Projected Close | In Shop/Coming Soon | Listings | Res. UC  │
├──────────────────────────────────────────────────────────────┤
│ June Closings Goal  |  Days Left in Month  |  Year to Date   │
├──────────────────────────────────────────────────────────────┤
│ CLOSING THIS WEEK — full-width card with addresses           │
├──────────────────────────────────────────────────────────────┤
│ Footer                                                       │
└──────────────────────────────────────────────────────────────┘
```

Grid template: `6vh 22vh 3.5vh 22vh minmax(0,1fr) 13vh 3.5vh`.

### Pipeline tiles — split vs. regular

- **Split tiles** (Addendums Sent, New Escrows, Projected Close) show:
  - Big number = **THIS WEEK** count (the headline)
  - Purple substat pill at bottom = "Mo · X" (the monthly count)
- **Regular tiles** show a single big number with a sublabel.

### Each tile's data binding

| Tile | data-metric (big number) | Source |
|---|---|---|
| Addendums Sent | `addendumsWeek` (Mo: `addendumsMonth`) | Offer Requests / Sent C+ Addendum, AD="Yes" AND AF in week/month |
| New Escrows | `acceptancesWeek` (Mo: `acceptancesAcq`) | Joseph current-month tab, A:B daily rows summed by week, B8 monthly |
| Acq. Under Contract | `inspectionAcq` | acq escrows column A: anything non-empty and not "Cancelled" |
| Insp. Accepted | `inspectionAccepted` | acq escrows column A: "Closing" OR "Need Funding" |
| Projected Close | `projectedClosingsWeek` (Mo: `projectedClosingsMonth`) | acq escrows column BL date in week/month |
| In Shop / Coming Soon | `inShopComingSoon` | listings column A NOT IN [Active, Under Contract, Sold] (non-empty) |
| Listings | `listingsForSale` | listings column A = "Active" |
| Res. Under Contract | `underContractResale` | listings column A = "Under Contract" |

### Hero tiles

| Side | This-Month metric | YTD metric | Source |
|---|---|---|---|
| Closed · Acquisitions | `closedAcqMonth` | `closedAcqYear` | closed tab, M contains "purchase", S in month |
| Closed · Resale | `closedResaleMonth` | `closedResaleYear` | closed tab, M contains "resale", S in month |

### Closing This Week card

Forward-looking. Pulls from:
- Acquisitions: `acquisition escrows` tab, columns B (address) + BL (date)
- Resales: `listings` tab, columns B (address) + AT (date)

Filter: close date in current **Monday-Sunday** week (Arizona time). Includes weekends because team sometimes enters Sat/Sun dates that close earlier in reality.

Display: up to 6 entries in a 2-column grid, day badge + address + Acquisition/Resale tag. "+N more" badge if more exist. Empty state: "No closings scheduled this week yet — let's change that."

## Important business logic

### Week definition: **Monday through Sunday** (Arizona time)

All weekly counts (Addendums, New Escrows, Projected Close, Closing This Week card) use this window. Helper functions: `currentMonSunWeek()`, `isInMonSunWeek(date, week)` in `api/metrics.js`.

### Month definition: standard calendar month in Arizona time

Used for monthly counts and the "MM/YYYY" tab naming in the Joseph sheet. Helper: `isCurrentMonth(cell)`.

### Goal: 25 closings per month

`GOAL_CLOSINGS_PER_MONTH = 25` in `api/metrics.js`. Composite metric `closingsMonth = closedAcqMonth + closedResaleMonth`. Goal milestone celebration fires when month total crosses 25.

### Theme: auto light/dark by time of day

- **Light** 6:00 AM – 7:00 PM Arizona
- **Dark** 7:00 PM – 6:00 AM
- `updateTheme()` runs on every 1-second tick. Sets `data-theme` attribute on `<body>`. CSS variables in `:root` (light) and `[data-theme="dark"]` (dark).

### Refresh cadence: every 30 minutes during business hours

Mon-Fri 7am-6pm Arizona. Off-hours/weekends the page stays current but doesn't fetch. Implemented in `tick()` in `public/app.js`. Edge cache: `s-maxage=240, stale-while-revalidate=60`.

### Animation hooks

- **Peek** (Zee pops up at bottom corner) — triggers on Addendums/New Escrows increase
- **Drop** (Zee drops from top) — triggers on hero closing-count increase
- **Swing** (Zee swings across screen) — triggers when monthly goal is crossed
- Banana confetti fires on any number increase
- Test keys: `p` = peek, `d` = drop, `s` = swing, `c` = confetti

### Slack alerting (optional)

Set `SLACK_WEBHOOK_URL` in Vercel env. If `/api/metrics` throws, sends a Slack message. Throttled to 1/hour.

### Custom assets in `public/assets/`

- `Zoodealio-Logo.png` — header logo
- `Closed Acquisitions Icon.png` — hero icon (left side). Note: filename has literal spaces.
- `Closed Resale Icon.png` — hero icon (right side)
- `Celebration-Zee.001.png` — used for peek + swing celebrations only (drop uses inline SVG)
- `zee-head.png` — small Zee head that rides the goal bar slider
- `acceptance-icon.png` — DEPRECATED, no longer referenced after commit 6 (New Escrows now uses inline SVG)

## Inline SVG icons (in `<defs>` of `index.html`)

All Lucide-inspired, 2px stroke, currentColor, 32x32 viewBox:
- `#i-paper-plane` — Addendums Sent
- `#i-file-plus` — New Escrows
- `#i-clipboard` — Acq. Under Contract
- `#i-shield-check` — Insp. Accepted
- `#i-calendar` — Projected Close
- `#i-clock` — In Shop / Coming Soon
- `#i-tag` — Listings
- `#i-tag-check` — Res. Under Contract
- `#i-check` — green circle check (used as overlay on tiles with strip-checked class)
- `#i-house-in` / `#i-house-sold` — hero icon fallbacks (real icons are the PNGs)
- `#i-handshake` — legacy, fallback for acceptance-icon.png
- `#zee` — full-body Zee mascot fallback

## Env vars (set in Vercel)

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — required
- `GOOGLE_SERVICE_ACCOUNT_KEY` — required (PEM, can be `\n`-escaped or base64)
- `DASHBOARD_TIMEZONE` — optional, defaults to `America/Phoenix`
- `JOSEPH_TAB` — optional override of the auto-computed `MM/YYYY` tab name
- `SLACK_WEBHOOK_URL` — optional, enables failure alerts

## Common debugging recipes

**Dashboard shows zeros for a metric**:
1. Hit `https://zoodealio-dashboard.vercel.app/api/metrics` directly in browser. See what the API returns.
2. If the field is `0` in the API response, the issue is in the sheet data or filter logic.
3. If the field is missing from the API response entirely, the issue is in the metrics.js code.

**A column moved in the sheet**:
1. Open `api/metrics.js`, find the `COLUMNS` block at the top.
2. Update the single column letter constant.
3. Update `docs/sheet-mapping.md` to match.
4. Commit + push.

**Animations not firing**:
- Use the keyboard test keys (`p`, `d`, `s`, `c`) to verify the animation engine works.
- Check that the metric's tile has the `data-celebrate="peek"` (or `drop`) attribute.
- Celebrations only fire when a metric goes UP, not on first load.

**Wrong calendar day showing**:
- The dashboard timezone is hard-coded fallback `America/Phoenix`. If Eliot moves offices, change `dashboardTz` default in `app.js` and `TIMEZONE` default in `metrics.js`, or set the `DASHBOARD_TIMEZONE` env var in Vercel.

## Pending / future work

These were discussed but not yet built:
- **Kiosk mode + password gate** on the TV (one-time browser/OS setup, no code change)
- **Verify on the real 65" TV** at full scale — schedule a viewing session
- **Cross-month week** edge case for New Escrows weekly read — if a Mon-Sun week spans month boundary, we only read the current month tab. Could add a next-month-tab read for robustness.
- **Per-rep leaderboard** — not yet planned, but a sibling dashboard exists at `eliot-zoodealio/zoodealio-warroom` with a leaderboard pattern that may eventually feed in.

## Style preferences (Eliot's taste, established through iterations)

- **Inter font** — clean, modern, sharp
- **Dark mode dominant** — looks great on the office TV at night
- **Tight number tracking** — `letter-spacing: -0.04em` to `-0.05em` on big numbers
- **Wide eyebrow tracking** — `letter-spacing: 0.08em` to `0.1em` for SECTION labels
- **Tinted sub-stat pills** — patterns borrowed from the war-room sibling dashboard
- **Zoodealio green** (`#8FC043`) is the brand accent; used sparingly for emphasis
- **Subtle purple** (`#9F7EE9` family) for "forward-looking" elements (substats, Days Left)
- **Acquisitions = blue accent**, **Resales = green accent**, for tag colors
- **The Zee mascot stays on the goal slider** — Eliot loves it, never remove

## Commit history reference (significant feature commits)

1. Initial UI build, Google Sheets integration, Zee animations, banana confetti
2. Switch refresh to business hours, switch timezone to Phoenix
3. Goal change 30 → 25
4. Layout polish — multiple iterations to tighten hero/strip sizes
5. Modernize icons (Lucide stroke style), hoist column constants, add Slack alerts
6. Major redesign: light + dark auto-switch + war-room visual language (Inter font, status pills, tinted substats)
7. Closing This Week card added (initially read from closed tab)
8. Projected Close → week/month split
9. New Escrows → week/month split (reads Joseph A:B daily rows)
10. Addendums Sent → new 8th pipeline tile (8-column grid)
11. Fix tile clipping, differentiate icons, restore Closed Resale to closed-tab logic
12. Closing This Week → switched to forward-looking sources (acq escrows BL + listings AT), Mon-Sun week

---

## When making changes

1. Read `docs/sheet-mapping.md` to see the canonical metric → sheet column mapping.
2. Edit `COLUMNS` block in `api/metrics.js` for any column changes.
3. Update `docs/sheet-mapping.md` to stay in sync.
4. Run `node --check api/metrics.js public/app.js` to verify syntax.
5. Have Eliot run `git add -A && git commit -m "..." && git push`.
6. Vercel auto-deploys in ~30s.
7. Verify on the live URL.

**Never break**:
- Existing `data-metric` bindings (the front-end DOM is data-driven)
- The Zee mascot on the goal slider
- The peek/drop/swing animations
- The auto light/dark switch
- The week definition (Mon-Sun, Arizona)
