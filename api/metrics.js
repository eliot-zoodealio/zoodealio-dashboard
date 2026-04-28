// api/metrics.js
//
// Vercel serverless function that returns live dashboard metrics as JSON.
// The full source-to-metric mapping lives in docs/sheet-mapping.md — keep them in sync.
//
// Env vars required:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_KEY   (PEM, with real newlines OR \n-escaped OR base64-encoded)
// Optional:
//   DASHBOARD_TIMEZONE  (IANA TZ; defaults to "America/Los_Angeles" — controls which calendar month is "current")
//   JOSEPH_TAB          (override the auto-computed "MM/YYYY" tab name in the Joseph - Tracking sheet)

import { google } from 'googleapis';

// ---------- Constants ----------

const SHEETS = {
  joseph: '17QTyDys-e4fossUY5PcGNFZtJdrzDrWkzAdrVXiEN9Q',
  escrows: '1hu6Zd2uAOpiVjBls1tyBHXyM1RAHRw9qMEwnUF_wtAY',
};

const TABS = {
  acquisitionsEscrows: 'acquisition escrows',
  listings: 'listings',
  closed: 'closed',
};

const GOAL_CLOSINGS_PER_MONTH = 30;

const TIMEZONE = process.env.DASHBOARD_TIMEZONE || 'America/Los_Angeles';

// ---------- Date helpers ----------

// Returns the current {year, month} in the dashboard's timezone. Month is 0-indexed.
function getCurrentYearMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value) - 1;
  return { year, month };
}

// Tab name convention in the Joseph - Tracking sheet: "MM/YYYY" for the current month
// (e.g. "04/2026", "05/2026").
function currentMonthTab() {
  const { year, month } = getCurrentYearMonth();
  const mm = String(month + 1).padStart(2, '0');
  return `${mm}/${year}`;
}

// ---------- Auth ----------

function loadPrivateKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');

  // If it doesn't look like a PEM, assume it's base64-encoded.
  let key = raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  // Normalize literal \n sequences into real newlines.
  key = key.replace(/\\n/g, '\n');
  return key;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL env var');
  return new google.auth.JWT({
    email,
    key: loadPrivateKey(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ---------- Google Sheets helpers ----------

async function batchGet(sheetsClient, spreadsheetId, ranges) {
  const resp = await sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return resp.data.valueRanges.map((vr) => vr.values || []);
}

// ---------- Row-level predicates ----------

function asString(v) {
  return String(v ?? '').trim();
}

function eqCI(a, b) {
  return asString(a).toLowerCase() === asString(b).toLowerCase();
}

function containsCI(cell, needle) {
  return asString(cell).toLowerCase().includes(asString(needle).toLowerCase());
}

function isCurrentMonth(cell) {
  if (cell === '' || cell === null || cell === undefined) return false;
  let cellYear, cellMonth;
  if (typeof cell === 'number') {
    // Google Sheets serial: days since 1899-12-30. Integer part = calendar date.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86400000);
    cellYear = d.getUTCFullYear();
    cellMonth = d.getUTCMonth();
  } else {
    const d = new Date(cell);
    if (Number.isNaN(d.getTime())) return false;
    cellYear = d.getUTCFullYear();
    cellMonth = d.getUTCMonth();
  }
  const { year, month } = getCurrentYearMonth();
  return cellYear === year && cellMonth === month;
}

// ---------- Count operations on single-column ranges ----------
// Ranges come back as Array<Array<any>> where each inner row is the row; for single-col
// reads, each row looks like [value] (or may be missing for empty rows).

function countEq(col, value) {
  return col.filter((row) => row && eqCI(row[0], value)).length;
}

function countContains(col, needle) {
  return col.filter((row) => row && containsCI(row[0], needle)).length;
}

function countNotEqNonEmpty(col, value) {
  return col.filter((row) => {
    if (!row) return false;
    const cell = asString(row[0]);
    if (cell === '') return false;
    return !eqCI(cell, value);
  }).length;
}

function countDateInCurrentMonth(col) {
  return col.filter((row) => row && isCurrentMonth(row[0])).length;
}

// Paired-row predicate (two columns of the same length, match by row index).
function countPaired(primary, secondary, primaryPred, secondaryPred) {
  const n = Math.max(primary.length, secondary.length);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const p = primary[i]?.[0];
    const s = secondary[i]?.[0];
    if (primaryPred(p) && secondaryPred(s)) count++;
  }
  return count;
}

// ---------- Handler ----------

export default async function handler(req, res) {
  try {
    const auth = getAuth();
    await auth.authorize();
    const sheetsClient = google.sheets({ version: 'v4', auth });

    // --- Joseph sheet: cell B8 on the current month's tab ("MM/YYYY", e.g. "04/2026") ---
    // Override with JOSEPH_TAB env var if you ever need to point at a specific tab.
    const josephTab = process.env.JOSEPH_TAB || currentMonthTab();
    const josephRange = `'${josephTab}'!B8`;
    let acceptancesAcq = 0;
    try {
      const [josephB8] = await batchGet(sheetsClient, SHEETS.joseph, [josephRange]);
      acceptancesAcq = Number(josephB8?.[0]?.[0] ?? 0) || 0;
    } catch (err) {
      // If the monthly tab doesn't exist yet (e.g. at the very start of a new month), keep 0
      // rather than failing the whole response. New month → make the tab → numbers light up.
      console.warn(`[metrics] could not read ${josephRange}: ${err.message}`);
    }

    // --- Escrows sheet: one batchGet across every needed range ---
    const escrowsRanges = [
      // 0: acquisitions escrows column A (statuses) — data starts at row 9
      `'${TABS.acquisitionsEscrows}'!A9:A`,
      // 1: acquisitions escrows column BK (projected close dates) — data starts at row 9
      `'${TABS.acquisitionsEscrows}'!BK9:BK`,
      // 2: closed tab column M (deal type)
      `'${TABS.closed}'!M6:M`,
      // 3: closed tab column S (close date) — paired with M by row
      `'${TABS.closed}'!S6:S`,
      // 4: listings tab column A (statuses)
      `'${TABS.listings}'!A10:A`,
      // 5: listings tab column AS (sold date) — paired with A by row
      `'${TABS.listings}'!AS10:AS`,
    ];
    const [acqStatus, acqProjectedDate, closedDealType, closedDate, listingStatus, listingSoldDate] =
      await batchGet(sheetsClient, SHEETS.escrows, escrowsRanges);

    // 2. Inspection Acquisition — anything in column A that is not empty and not "Cancelled"
    const inspectionAcq = countNotEqNonEmpty(acqStatus, 'Cancelled');

    // 3. Inspection Accepted Acq — column A = "Closing" or "Need Funding"
    const inspectionAccepted = countEq(acqStatus, 'Closing') + countEq(acqStatus, 'Need Funding');

    // 4. Projected Closings Acq (month) — column BK date is in current month
    const projectedClosingsMonth = countDateInCurrentMonth(acqProjectedDate);

    // 5a. Closed Acquisitions (year) — column M contains "Purchase"
    const closedAcqYear = countContains(closedDealType, 'purchase');

    // 5b. Closed Acquisitions (month) — M contains "Purchase" AND S is a date in current month
    const closedAcqMonth = countPaired(
      closedDealType,
      closedDate,
      (v) => containsCI(v, 'purchase'),
      (v) => isCurrentMonth(v),
    );

    // 6. Renovations in Process — column A = "Reno In Process"
    const renovationsInProcess = countEq(listingStatus, 'Reno In Process');

    // 7. Listings For Sale — column A = "Active"
    const listingsForSale = countEq(listingStatus, 'Active');

    // 8. Under Contract Resale — column A = "Under Contract"
    const underContractResale = countEq(listingStatus, 'Under Contract');

    // 9a. Closed Resale (year) — column A = "Sold" (2026-only sheet)
    const closedResaleYear = countEq(listingStatus, 'Sold');

    // 9b. Closed Resale (month) — A = "Sold" AND AS is a date in current month
    const closedResaleMonth = countPaired(
      listingStatus,
      listingSoldDate,
      (v) => eqCI(v, 'Sold'),
      (v) => isCurrentMonth(v),
    );

    // Composite totals
    const closingsMonth = closedAcqMonth + closedResaleMonth;
    const closingsYear = closedAcqYear + closedResaleYear;
    const goalProgress = Math.min(1, closingsMonth / GOAL_CLOSINGS_PER_MONTH);

    const payload = {
      updatedAt: new Date().toISOString(),
      timezone: TIMEZONE,
      josephTab,
      metrics: {
        acceptancesAcq,
        inspectionAcq,
        inspectionAccepted,
        projectedClosingsMonth,
        closedAcqMonth,
        closedAcqYear,
        renovationsInProcess,
        listingsForSale,
        underContractResale,
        closedResaleMonth,
        closedResaleYear,
      },
      totals: {
        closingsMonth,
        closingsYear,
        goalMonth: GOAL_CLOSINGS_PER_MONTH,
        goalProgress,
        goalRemaining: Math.max(0, GOAL_CLOSINGS_PER_MONTH - closingsMonth),
      },
    };

    // Edge cache: serve from cache for 4 min, allow stale-while-revalidate for 1 more.
    res.setHeader('Cache-Control', 's-maxage=240, stale-while-revalidate=60');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[metrics] error', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
