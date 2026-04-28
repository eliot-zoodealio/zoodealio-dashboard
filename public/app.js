// ===========================================================
// Zoodealio Office Dashboard — front-end logic
//
// Responsibilities:
//   1. Poll /api/metrics every 5 minutes.
//   2. Update DOM bindings (any element with data-metric=...).
//   3. Detect increases on celebration-flagged metrics (Acceptances,
//      Closings) and trigger Zee animations + confetti.
//   4. Update the goal bar fill + Zee position on the bar.
// ===========================================================

const REFRESH_MS = 5 * 60 * 1000;
const METRIC_KEYS = [
  'acceptancesAcq',
  'inspectionAcq',
  'inspectionAccepted',
  'projectedClosingsMonth',
  'closedAcqMonth',
  'closedAcqYear',
  'renovationsInProcess',
  'listingsForSale',
  'underContractResale',
  'closedResaleMonth',
  'closedResaleYear',
];

let lastSnapshot = null;
let firstRender = true;

// ---------- Fetch loop ----------

async function fetchMetrics() {
  try {
    const resp = await fetch('/api/metrics', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    render(data);
    setStatus('ok', data.updatedAt);
  } catch (err) {
    console.error('[dashboard] fetch failed:', err);
    setStatus('error', null, err.message);
  }
}

// ---------- Rendering ----------

function render(data) {
  const old = lastSnapshot;

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

  // Goal milestone celebration (cross 30 for the first time)
  if (
    old &&
    old.totals.closingsMonth < data.totals.goalMonth &&
    data.totals.closingsMonth >= data.totals.goalMonth
  ) {
    triggerCelebration('swing');
    confettiBurst({ x: 0.5, y: 0.4, count: 100 });
  }

  // Month label
  const monthName = formatMonth(data.timezone);
  setText('goal-month', monthName);
  setText('footer-month', monthName);

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
      if (celebrate) triggerCelebration(celebrate, el);
    }
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

function setStatus(state, updatedAt, errMsg) {
  const dot = document.getElementById('status-dot');
  const time = document.getElementById('status-time');
  if (!dot || !time) return;
  if (state === 'ok') {
    dot.classList.remove('error');
    time.textContent = formatTime(updatedAt);
  } else {
    dot.classList.add('error');
    time.textContent = errMsg ? `Error · ${errMsg.slice(0, 24)}` : 'Error';
  }
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

// ===========================================================
// Zee celebration animations
// ===========================================================

function triggerCelebration(type, sourceEl) {
  const stage = document.getElementById('zee-stage');
  if (!stage) return;

  const actor = document.createElement('div');
  actor.className = `zee-actor ${type}`;
  actor.innerHTML = '<svg viewBox="0 0 100 108"><use href="#zee"/></svg>';

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
// Map-pin confetti (canvas)
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
  const palette = ['#8FC043', '#1A5EBF', '#3D6FB5', '#0E50B0', '#B5DC6E'];

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
      size: 12 + Math.random() * 12,
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
    drawPin(confettiCtx, p);
  }

  if (confettiPieces.length > 0) {
    requestAnimationFrame(stepConfetti);
  } else {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiAnimating = false;
  }
}

function drawPin(ctx, p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  const s = p.size / 20;
  ctx.scale(s, s);

  // Map-pin teardrop body
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(10, 22);
  ctx.bezierCurveTo(2, 13, 0, 7, 4, 4);
  ctx.bezierCurveTo(8, 1, 12, 1, 16, 4);
  ctx.bezierCurveTo(20, 7, 18, 13, 10, 22);
  ctx.closePath();
  ctx.fill();

  // White inner dot
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(10, 8, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

window.addEventListener('resize', initConfetti);
initConfetti();

// ===========================================================
// Boot
// ===========================================================

fetchMetrics();
setInterval(fetchMetrics, REFRESH_MS);

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
