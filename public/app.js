// ===========================================================
// Zoodealio Office Dashboard — front-end logic
//
// Responsibilities:
//   1. Poll /api/metrics every 30 minutes during business hours
//      (Mon–Fri, 7am–6pm in the dashboard's timezone). Pause overnight
//      and on weekends to avoid hammering Sheets when no one's looking.
//   2. Update DOM bindings (any element with data-metric=...).
//   3. Detect increases on celebration-flagged metrics (Acceptances,
//      Closings) and trigger Zee animations. Burst banana confetti from
//      ANY tile whose number ticks up.
//   4. Update the goal bar fill + Zee position on the bar.
// ===========================================================

const REFRESH_MS = 30 * 60 * 1000; // 30 minutes between fetches during business hours
const BUSINESS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const BUSINESS_HOUR_START = 7;  // 7:00 AM (inclusive)
const BUSINESS_HOUR_END = 18;   // 6:00 PM (exclusive — last refresh at 5:30pm)

const METRIC_KEYS = [
  'acceptancesAcq',
  'inspectionAcq',
  'inspectionAccepted',
  'projectedClosingsMonth',
  'closedAcqMonth',
  'closedAcqYear',
  'inShopComingSoon',
  'listingsForSale',
  'underContractResale',
  'closedResaleMonth',
  'closedResaleYear',
];

let lastSnapshot = null;
let firstRender = true;
let lastFetchAt = 0;
let isFetching = false;
let dashboardTz = 'America/Phoenix'; // Arizona time, no DST; overridden once /api/metrics responds
let errorState = null; // when set, surfaced in the header label until next ok fetch

// ---------- Fetch loop ----------

async function fetchMetrics() {
  if (isFetching) return;
  isFetching = true;
  lastFetchAt = Date.now(); // claim the slot up front so the tick loop doesn't double-fire
  try {
    const resp = await fetch('/api/metrics', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    render(data);
    setStatus('ok', data.updatedAt);
  } catch (err) {
    console.error('[dashboard] fetch failed:', err);
    setStatus('error', null, err.message);
  } finally {
    isFetching = false;
    updateRefreshCountdown();
  }
}

// Tick fired once per second. Updates the countdown label and decides whether
// it's time to fetch again. Fetch only when (a) we're in business hours and
// (b) at least REFRESH_MS has passed since the last fetch.
function tick() {
  if (
    !isFetching &&
    isBusinessHours() &&
    Date.now() - lastFetchAt >= REFRESH_MS
  ) {
    fetchMetrics();
  }
  updateRefreshCountdown();
  updateTheme();
}

// True when "now" is Mon-Fri between 7am and 6pm in the dashboard's timezone.
function isBusinessHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTz,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  return (
    BUSINESS_DAYS.includes(weekday) &&
    hour >= BUSINESS_HOUR_START &&
    hour < BUSINESS_HOUR_END
  );
}

// Returns the timestamp (ms) when business hours next open. Walks forward in
// 5-minute steps and returns the first hit. Capped at 5 days to avoid loops.
function nextBusinessOpenMs() {
  const stepMs = 5 * 60 * 1000;
  const now = Date.now();
  for (let i = 1; i <= (5 * 24 * 60) / 5; i++) {
    const candidate = now + i * stepMs;
    if (isBusinessHours(new Date(candidate))) return candidate;
  }
  return now + REFRESH_MS;
}

// Formats a ms timestamp as a clock time in the dashboard tz. Includes the
// weekday short name when it isn't today (so off-hours and weekend handoffs
// read clearly: "Mon 7:00 AM" vs "9:00 AM").
function formatClock(ms) {
  const target = new Date(ms);
  const todayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTz, year: 'numeric', month: 'numeric', day: 'numeric',
  }).format(new Date());
  const targetStr = new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTz, year: 'numeric', month: 'numeric', day: 'numeric',
  }).format(target);
  const sameDay = todayStr === targetStr;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTz,
    weekday: sameDay ? undefined : 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(target);
}

// Formats a remaining duration (ms) as either "M:SS" (under an hour) or
// "Hh Mm" (over an hour) — keeps off-hours countdowns readable.
function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Updates the upper-right header: big number is the CURRENT clock time
// (so it matches a wall clock at a glance), with a small subtitle that
// shows when the next refresh will run and a live countdown to it.
// During business hours the next refresh is lastFetchAt + 30m;
// off-hours it points at the next time business hours open.
function updateRefreshCountdown() {
  const timeEl = document.getElementById('status-time');
  const labelEl = document.getElementById('status-label');
  if (!timeEl || !labelEl) return;

  const now = Date.now();
  const inBiz = isBusinessHours();
  const nextMs = inBiz ? lastFetchAt + REFRESH_MS : nextBusinessOpenMs();
  const remainingMs = Math.max(0, nextMs - now);

  // Big top line: current clock time in the dashboard's timezone.
  timeEl.textContent = formatClock(now);
  // Small bottom line: "next update 5:15 PM · in 29:24" — or surface an
  // error state until the next successful fetch clears it.
  if (errorState) {
    labelEl.textContent = errorState;
  } else {
    labelEl.textContent =
      `next update ${formatClock(nextMs)} · in ${formatCountdown(remainingMs)}`;
  }
}

// ---------- Rendering ----------

function render(data) {
  const old = lastSnapshot;
  if (data.timezone) dashboardTz = data.timezone;

  // Per-metric updates
  for (const key of METRIC_KEYS) {
    const value = data.metrics[key] ?? 0;
    const oldValue = old?.metrics?.[key];
    updateMetric(key, value, oldValue);
  }

  // Composite totals
  updateMetric('closingsMonth', data.totals.closingsMonth, old?.totals?.closingsMonth);
  updateMetric('goalRemaining', data.totals.goalRemaining);

  // Goal bar
  setGoalProgress(data.totals.goalProgress);

  // Goal % readout (rounded to whole percent)
  setText('goal-pct', Math.round((data.totals.goalProgress || 0) * 100));

  // Year-to-date total (acquisitions + resales)
  const ytdTotal =
    Number(data.metrics?.closedAcqYear || 0) +
    Number(data.metrics?.closedResaleYear || 0);
  setText('ytd-total', formatNumber(ytdTotal));

  // Days left in current calendar month (in dashboard timezone)
  const daysLeft = daysLeftInMonth(data.timezone);
  setText('days-left', daysLeft);
  setText('days-left-big', daysLeft);

  // Goal milestone celebration (cross 30 for the first time)
  if (
    old &&
    old.totals.closingsMonth < data.totals.goalMonth &&
    data.totals.closingsMonth >= data.totals.goalMonth
  ) {
    triggerCelebration('swing');
    confettiBurst({ x: 0.5, y: 0.4, count: 100 });
  }

  // Month label (e.g. "April 2026" + short month name for the goal eyebrow)
  const monthName = formatMonth(data.timezone);
  setText('footer-month', monthName);
  setText('goal-month-label', formatMonthShort(data.timezone));

  // Three-letter month chip on the hero cards (JUN, JUL, etc.)
  const monthChip = formatMonthChip(data.timezone);
  setText('hero-month-acq', monthChip);
  setText('hero-month-resale', monthChip);

  // Goal pace pill — auto-classifies the current pace vs days elapsed
  updateGoalPacePill(data.totals, data.timezone);

  lastSnapshot = data;
  firstRender = false;
}

function updateMetric(key, value, oldValue) {
  document.querySelectorAll(`[data-metric="${key}"]`).forEach((el) => {
    const current = Number(el.textContent.replace(/[^\d-]/g, '')) || 0;
    const incoming = Number(value) || 0;
    if (current === incoming && !firstRender) return;

    el.textContent = formatNumber(incoming);

    // Trigger pop + celebration only when we know an old value and it grew.
    if (!firstRender && oldValue != null && incoming > oldValue) {
      popNumber(el);
      const celebrate = el.dataset.celebrate;
      if (celebrate) {
        // Marquee tiles get the full Zee animation (and 'drop' includes its own confetti).
        triggerCelebration(celebrate, el);
      } else {
        // Every other tile still celebrates — short banana confetti burst from the tile center.
        burstFromElement(el, 28);
      }
    }
  });
}

// Helper: confetti burst centered on an element's bounding box.
function burstFromElement(el, count = 30) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  confettiBurst({
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
    count,
  });
}

function formatNumber(n) {
  return Number(n).toLocaleString('en-US');
}

function popNumber(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function setGoalProgress(progress) {
  const pct = Math.min(100, Math.max(0, (progress || 0) * 100));
  const fill = document.getElementById('goal-fill');
  const zee = document.getElementById('goal-fill-zee');
  if (fill) fill.style.width = `${pct}%`;
  if (zee) zee.style.left = `${pct}%`;
}

function setStatus(state, _updatedAt, errMsg) {
  const dot = document.getElementById('status-dot');
  if (!dot) return;
  if (state === 'ok') {
    dot.classList.remove('error');
    errorState = null;
  } else {
    dot.classList.add('error');
    errorState = errMsg ? `Error · ${errMsg.slice(0, 24)}` : 'Error';
  }
  // Repaint immediately so the user sees the error or recovery without
  // having to wait for the next 1-second tick.
  updateRefreshCountdown();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatMonth(tz) {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: tz || undefined,
  });
}

function formatMonthShort(tz) {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    timeZone: tz || undefined,
  });
}

// Three-letter uppercase month for the hero card chips (e.g. "JUN").
function formatMonthChip(tz) {
  return new Date()
    .toLocaleDateString('en-US', { month: 'short', timeZone: tz || undefined })
    .toUpperCase();
}

// Compares current closings progress to the expected pace by day-of-month and
// updates the goal-pace pill (ELITE PACE / ON PACE / BEHIND PACE).
function updateGoalPacePill(totals, tz) {
  const pill = document.getElementById('goal-pace-pill');
  if (!pill || !totals) return;
  const daysIn = daysIntoMonth(tz);
  const daysInMonth = daysIn + daysLeftInMonth(tz);
  if (daysInMonth <= 0) return;
  const expectedFrac = daysIn / daysInMonth;
  const actualFrac = totals.goalProgress || 0;
  // ratio > 1.15 = elite, 0.9–1.15 = on pace, < 0.9 = behind.
  const ratio = expectedFrac > 0 ? actualFrac / expectedFrac : actualFrac;

  let label, cls;
  if (ratio >= 1.15) { label = 'ELITE PACE'; cls = 'pace-elite'; }
  else if (ratio >= 0.9) { label = 'ON PACE'; cls = 'pace-on'; }
  else { label = 'BEHIND PACE'; cls = 'pace-behind'; }
  pill.textContent = label;
  pill.className = `card-status-pill ${cls}`;
}

// How many full days have elapsed in the current month (0 on the 1st).
function daysIntoMonth(tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || undefined,
    day: 'numeric',
  });
  return Math.max(0, Number(fmt.format(new Date())) - 1);
}

// ---------- Theme (auto light/dark) ----------
// Light during business-ish daylight (6:00 AM – 7:00 PM Arizona); dark otherwise.
// Runs on boot + inside the 1-second tick so the transition happens automatically
// without needing a page reload.
function updateTheme() {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTz,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const hour = Number(hourStr);
  const isDark = hour >= 19 || hour < 6;
  const target = isDark ? 'dark' : 'light';
  if (document.body.dataset.theme !== target) {
    document.body.dataset.theme = target;
  }
}

// Days remaining in the current calendar month (inclusive of today).
// Computed in the dashboard's timezone so the count flips at local midnight.
function daysLeftInMonth(tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);
  // Day 0 of next month = last day of current month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(0, lastDay - day);
}

// ===========================================================
// Zee celebration animations
// ===========================================================

function triggerCelebration(type, sourceEl) {
  const stage = document.getElementById('zee-stage');
  if (!stage) return;

  const actor = document.createElement('div');
  actor.className = `zee-actor ${type}`;
  // Celebration-Zee.001.png is used ONLY for peek + swing animations.
  // Drop animation uses the inline SVG full-body Zee (the asset doesn't fit
  // a top-down drop motion). Same fallback pattern (onerror -> inline SVG)
  // is used by the goal-bar marker and other branded slots.
  const useAsset = type === 'peek' || type === 'swing';
  if (useAsset) {
    actor.innerHTML =
      '<img src="/assets/Celebration-Zee.001.png" alt="" ' +
      'onerror="this.outerHTML=\'<svg viewBox=&quot;0 0 100 108&quot;><use href=&quot;#zee&quot;/></svg>\'">';
  } else {
    actor.innerHTML = '<svg viewBox="0 0 100 108"><use href="#zee"/></svg>';
  }

  if (type === 'peek') {
    // Bottom corner — left for acquisitions side, right for resale side
    const fromLeft = sourceEl
      ? sourceEl.getBoundingClientRect().left < window.innerWidth / 2
      : true;
    if (fromLeft) {
      actor.style.left = '6vw';
    } else {
      actor.style.right = '6vw';
    }
    actor.style.bottom = '6vw';
  } else if (type === 'drop' && sourceEl) {
    // Drop above the source tile, then animate downward
    const rect = sourceEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    actor.style.left = `${cx}px`;
    actor.style.top = `${Math.max(rect.top - 50, 80)}px`;
    confettiBurst({
      x: cx / window.innerWidth,
      y: rect.top / window.innerHeight,
      count: 70,
    });
  } else if (type === 'swing') {
    // Center stage above the goal bar
    actor.style.left = '50%';
    actor.style.top = '8vw';
  } else {
    actor.style.left = '50%';
    actor.style.top = '20%';
  }

  stage.appendChild(actor);

  const cleanupMs = type === 'peek' ? 4500 : type === 'drop' ? 4000 : 3000;
  setTimeout(() => actor.remove(), cleanupMs);
}

// ===========================================================
// Banana confetti (canvas)
// Each piece is a little curved crescent banana. Palette is mostly banana
// yellows with a couple of brand accents so the whole effect still feels
// on-brand against the deep-blue / green dashboard.
// ===========================================================

const confettiCanvas = document.getElementById('confetti');
let confettiCtx = null;
const confettiPieces = [];
let confettiAnimating = false;

function initConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiCtx = confettiCanvas.getContext('2d');
}

function confettiBurst({ x = 0.5, y = 0.4, count = 50 } = {}) {
  if (!confettiCtx) initConfetti();
  if (!confettiCtx) return;

  const cx = x * window.innerWidth;
  const cy = y * window.innerHeight;
  // Banana yellows in front, with a couple of brand accents sprinkled in.
  const palette = [
    '#FFD93D', // bright banana
    '#F5D547', // ripe banana
    '#F8E16C', // pale banana
    '#FCE96A', // cream
    '#E8B923', // golden
    '#8FC043', // brand green (banana leaf)
    '#1A5EBF', // brand deep blue (rare accent)
  ];

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
    const speed = 6 + Math.random() * 8;
    confettiPieces.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed * 0.7,
      vy: Math.sin(angle) * speed,
      gravity: 0.22,
      rotation: Math.random() * Math.PI * 2,
      vRotation: (Math.random() - 0.5) * 0.25,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 16 + Math.random() * 14, // bananas need a touch more bulk than pins
      life: 1,
      decay: 0.005 + Math.random() * 0.005,
    });
  }

  if (!confettiAnimating) {
    confettiAnimating = true;
    requestAnimationFrame(stepConfetti);
  }
}

function stepConfetti() {
  if (!confettiCtx) {
    confettiAnimating = false;
    return;
  }
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  for (let i = confettiPieces.length - 1; i >= 0; i--) {
    const p = confettiPieces[i];
    p.vy += p.gravity;
    p.vx *= 0.995;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.vRotation;
    p.life -= p.decay;

    if (p.life <= 0 || p.y > confettiCanvas.height + 60) {
      confettiPieces.splice(i, 1);
      continue;
    }
    drawBanana(confettiCtx, p);
  }

  if (confettiPieces.length > 0) {
    requestAnimationFrame(stepConfetti);
  } else {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiAnimating = false;
  }
}

// Draws a tiny crescent-shaped banana centered at (0,0) in the local frame.
// Coordinate system spans roughly x: -14..14, y: -10..10 — divisor in
// confettiBurst (size / 20) keeps the visual scale consistent with old pins.
function drawBanana(ctx, p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  const s = p.size / 20;
  ctx.scale(s, s);

  // Banana body — outer arc curls up, inner arc curls back
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(-12, 4);
  ctx.bezierCurveTo(-12, -10, 6, -12, 13, -4); // top curve, left tip → right shoulder
  ctx.bezierCurveTo(15, -1, 14, 2, 11, 4);     // right tip
  ctx.bezierCurveTo(8, 5, 5, 4, 0, 6);         // belly
  ctx.bezierCurveTo(-5, 8, -10, 8, -12, 4);    // back to left tip
  ctx.closePath();
  ctx.fill();

  // Subtle highlight stripe down the inner curve
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.bezierCurveTo(-4, -5, 6, -7, 11, -2);
  ctx.stroke();

  // Tiny darker tips so it reads as a banana, not just a blob
  ctx.fillStyle = 'rgba(80, 50, 0, 0.55)';
  ctx.beginPath();
  ctx.arc(-12, 4, 1.4, 0, Math.PI * 2);
  ctx.arc(13, -3, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

window.addEventListener('resize', initConfetti);
initConfetti();

// ===========================================================
// Boot
// ===========================================================

// Apply the correct theme before first paint so the user never sees a flash
// of the wrong palette.
updateTheme();
// Always pull data on first load — even off-hours — so the dashboard isn't
// blank when someone glances at it before 7am or over the weekend.
fetchMetrics();
// One-second tick handles the live countdown, the business-hours-aware
// refresh cadence, AND the time-of-day theme switch.
setInterval(tick, 1000);
updateRefreshCountdown();

// Quick keyboard hooks for testing celebrations without waiting for sheet changes.
// Press 'p' for peek, 'd' for drop, 's' for swing. Disable in production by removing
// this block (or leave it — kiosk has no keyboard).
window.addEventListener('keydown', (e) => {
  if (e.key === 'p') triggerCelebration('peek');
  if (e.key === 'd') {
    const target = document.querySelector('[data-metric="closedAcqMonth"]');
    triggerCelebration('drop', target);
  }
  if (e.key === 's') triggerCelebration('swing');
  if (e.key === 'c') confettiBurst({ x: 0.5, y: 0.4, count: 80 });
});
