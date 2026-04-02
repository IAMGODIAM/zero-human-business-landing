/* ── Agent Business OS · Script ──────────────────────────────────────────── */

/* ── Utilities ──────────────────────────────────────────────────────────── */

function currency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function getUTM() {
  const p = new URLSearchParams(window.location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const out = {};
  for (const k of keys) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return { ok: true, data: JSON.parse(text), raw: text };
  } catch {
    return { ok: false, data: null, raw: text };
  }
}

function hashInt(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getVisitorId() {
  const key = 'aro_visitor_id_v1';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `v_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

/* ── Experiment Variants ────────────────────────────────────────────────── */

const HEADLINE_VARIANTS = [
  {
    id: 'h1',
    headline: 'Build an agent-run business engine that scales lead-to-cash without scaling headcount.',
    subline: 'We deploy your full operating stack: market intelligence, automated demand generation, qualification, conversion workflows, client onboarding, KPI reporting, and exception-only escalation.'
  },
  {
    id: 'h2',
    headline: 'Turn your service business into a daily cash machine with autonomous lead-to-close operations.',
    subline: 'Deploy a founder-controlled AI operating system that captures demand, qualifies buyers, and drives booked calls without operational chaos.'
  },
  {
    id: 'h3',
    headline: 'Install a revenue OS that compounds booked calls, close rate, and net cash every week.',
    subline: 'We combine outbound discipline, qualification logic, and KPI-driven optimization into one execution stack with clear escalation gates.'
  },
  {
    id: 'h4',
    headline: 'From fragmented hustle to systemized growth: launch your autonomous business stack in days.',
    subline: 'Get production-ready capture, follow-up, and reporting lanes designed for founder-led teams that need speed and control.'
  },
  {
    id: 'h5',
    headline: 'Stop leaking revenue: deploy an AI-guided operating system that converts intent into cashflow.',
    subline: 'We build the infrastructure for qualified bookings, tight follow-up loops, and measurable cash/day improvement.'
  }
];

const OFFER_VARIANTS = [
  {
    id: 'o1',
    title: 'Operator',
    price: '$6,000 setup + $900/mo',
    points: ['Full lead-to-cash system', 'Research + strategy cadence', 'Optimization loop']
  },
  {
    id: 'o2',
    title: 'Performance Sprint',
    price: '$3,500 setup + $1,500/mo',
    points: ['Qualification + booking acceleration', 'Daily outbound execution board', 'Weekly winner/loser optimization memo']
  }
];

/* ── Experiment Assignment ──────────────────────────────────────────────── */

function getExperimentAssignment() {
  const p = new URLSearchParams(window.location.search);
  const forcedH = Number(p.get('h'));
  const forcedO = Number(p.get('o'));

  const visitorId = getVisitorId();
  const seedSource = `${visitorId}|${p.get('utm_source') || ''}|${p.get('utm_campaign') || ''}`;
  const hSeed = hashInt(`${seedSource}|headline`);
  const oSeed = hashInt(`${seedSource}|offer`);

  const hIndex = Number.isInteger(forcedH) && forcedH >= 1 && forcedH <= HEADLINE_VARIANTS.length
    ? forcedH - 1
    : hSeed % HEADLINE_VARIANTS.length;
  const oIndex = Number.isInteger(forcedO) && forcedO >= 1 && forcedO <= OFFER_VARIANTS.length
    ? forcedO - 1
    : oSeed % OFFER_VARIANTS.length;

  const h = HEADLINE_VARIANTS[hIndex];
  const o = OFFER_VARIANTS[oIndex];

  return {
    version: 'b2-v1',
    visitorId,
    hIndex,
    oIndex,
    headlineId: h.id,
    offerId: o.id,
    comboId: `${h.id}-${o.id}`,
    headline: h,
    offer: o,
    forced: Number.isInteger(forcedH) || Number.isInteger(forcedO)
  };
}

/* ── Apply Experiment to Page ───────────────────────────────────────────── */

function applyExperimentToPage(exp) {
  const headlineEl = document.getElementById('heroHeadline');
  const sublineEl = document.getElementById('heroSubline');
  const badgeEl = document.getElementById('expBadge');
  const offerTitleEl = document.getElementById('offerVariantTitle');
  const offerPriceEl = document.getElementById('offerVariantPrice');
  const offerPointsEl = document.getElementById('offerVariantPoints');

  if (headlineEl) headlineEl.textContent = exp.headline.headline;
  if (sublineEl) sublineEl.textContent = exp.headline.subline;
  if (badgeEl) badgeEl.textContent = `Experiment ${exp.comboId.toUpperCase()} (${exp.version})${exp.forced ? ' • forced via URL' : ''}`;

  if (offerTitleEl) offerTitleEl.textContent = exp.offer.title;
  if (offerPriceEl) offerPriceEl.textContent = exp.offer.price;
  if (offerPointsEl) {
    offerPointsEl.innerHTML = exp.offer.points.map((p) => `<li>${p}</li>`).join('');
  }
}

const EXPERIMENT = getExperimentAssignment();
applyExperimentToPage(EXPERIMENT);

/* ── Attribution Tags ───────────────────────────────────────────────────── */

function attributionTags() {
  const p = new URLSearchParams(window.location.search);
  return {
    ...getUTM(),
    exp_version: EXPERIMENT.version,
    exp_headline: EXPERIMENT.headlineId,
    exp_offer: EXPERIMENT.offerId,
    exp_combo: EXPERIMENT.comboId,
    exp_forced: String(EXPERIMENT.forced),
    visitor_id: EXPERIMENT.visitorId,
    referrer: document.referrer || '',
    landing_path: window.location.pathname,
    landing_query: p.toString()
  };
}

/* ── ROI Forecaster ─────────────────────────────────────────────────────── */

const roiForm = document.getElementById('roiForm');
const roiOutput = document.getElementById('roiOutput');

roiForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const leads = Number(document.getElementById('leads').value || 0);
  const closeRate = Number(document.getElementById('closeRate').value || 0) / 100;
  const dealValue = Number(document.getElementById('dealValue').value || 0);
  const lift = Number(document.getElementById('lift').value || 0) / 100;
  const cost = Number(document.getElementById('cost').value || 0);

  const baselineDeals = leads * closeRate;
  const liftedDeals = leads * (closeRate * (1 + lift));
  const incrementalDeals = Math.max(0, liftedDeals - baselineDeals);
  const incrementalRevenue = incrementalDeals * dealValue;
  const netLift = incrementalRevenue - cost;

  roiOutput.innerHTML = `
    <h3>Projected monthly impact</h3>
    <p>Baseline deals: <strong>${baselineDeals.toFixed(1)}</strong></p>
    <p>Lifted deals: <strong>${liftedDeals.toFixed(1)}</strong></p>
    <p>Incremental revenue: <strong>${currency(incrementalRevenue)}</strong></p>
    <p>Automation cost: <strong>${currency(cost)}</strong></p>
    <p>Net impact: <strong>${currency(netLift)}</strong></p>
  `;
});

/* ── Lead / Build Request Form ──────────────────────────────────────────── */

const leadForm = document.getElementById('leadForm');
const leadStatus = document.getElementById('leadStatus');

leadForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    company: document.getElementById('company').value,
    target: document.getElementById('target').value,
    stack: document.getElementById('stack').value,
    utm: attributionTags(),
    submittedAt: new Date().toISOString(),
    source: `zero-human-business-landing|${EXPERIMENT.comboId}`
  };

  leadStatus.textContent = 'Submitting build request...';

  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const parsed = await safeJson(res);
    if (!res.ok) {
      throw new Error(parsed.raw || `HTTP ${res.status}`);
    }

    leadStatus.textContent = 'Build request submitted successfully. We will follow up shortly.';
    leadForm.reset();
    return;
  } catch (err) {
    const fallbackBody = encodeURIComponent(JSON.stringify(payload, null, 2));
    const mailto = `mailto:israel@e5enclave.com?subject=Agent%20OS%20Build%20Request&body=${fallbackBody}`;
    leadStatus.textContent = `API not available (${err.message}). Opening email fallback...`;
    window.location.href = mailto;
  }
});

/* ── Qualification Scoring ──────────────────────────────────────────────── */

const qualForm = document.getElementById('qualForm');
const qualStatus = document.getElementById('qualStatus');

function computeQualificationProfile() {
  const monthlyRevenue = Number(document.getElementById('q_revenue').value || 0);
  const desiredLift = Number(document.getElementById('q_lift').value || 0);
  const bottleneck = String(document.getElementById('q_bottleneck').value || '');
  const canStartIn7Days = String(document.getElementById('q_start').value || '');

  let fitScore = 0;
  if (monthlyRevenue >= 50000) fitScore += 35;
  else if (monthlyRevenue >= 20000) fitScore += 28;
  else if (monthlyRevenue >= 10000) fitScore += 22;
  else if (monthlyRevenue >= 5000) fitScore += 14;
  else if (monthlyRevenue > 0) fitScore += 8;

  if (desiredLift >= 30000) fitScore += 30;
  else if (desiredLift >= 15000) fitScore += 24;
  else if (desiredLift >= 8000) fitScore += 18;
  else if (desiredLift >= 3000) fitScore += 12;
  else if (desiredLift > 0) fitScore += 6;

  if (canStartIn7Days === 'Yes') fitScore += 20;
  else if (canStartIn7Days === 'No') fitScore += 4;

  if (bottleneck === 'Follow-up consistency' || bottleneck === 'Close rate') fitScore += 15;
  else if (bottleneck) fitScore += 8;

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  let priority = 'nurture';
  let responseSlaMinutes = 240;
  if (fitScore >= 75 && canStartIn7Days === 'Yes') {
    priority = 'hot';
    responseSlaMinutes = 15;
  } else if (fitScore >= 55) {
    priority = 'warm';
    responseSlaMinutes = 60;
  }

  return {
    form: 'qualification',
    monthlyRevenue,
    desiredLift,
    bottleneck,
    canStartIn7Days,
    fitScore,
    priority,
    responseSlaMinutes,
    experiment: {
      version: EXPERIMENT.version,
      headlineId: EXPERIMENT.headlineId,
      offerId: EXPERIMENT.offerId,
      comboId: EXPERIMENT.comboId
    }
  };
}

/* ── Qualification Form → Azure Container App Webhook ───────────────────── */
const QUALIFICATION_WEBHOOK_URL = 'https://qual-webhook.orangehill-b7025e2b.eastus2.azurecontainerapps.io/api/qualify';

qualForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = qualForm.querySelector('button[type="submit"]');
  const profile = computeQualificationProfile();
  const payload = {
    name: document.getElementById('q_name').value,
    email: document.getElementById('q_email').value,
    company: 'Qualification Form',
    target: `$${profile.desiredLift} monthly lift`,
    stack: JSON.stringify(profile),
    monthlyRevenue: profile.monthlyRevenue,
    desiredLift: profile.desiredLift,
    bottleneck: profile.bottleneck,
    canStartIn7Days: profile.canStartIn7Days,
    fitScore: profile.fitScore,
    priority: profile.priority,
    responseSlaMinutes: profile.responseSlaMinutes,
    formType: 'qualification',
    utm: attributionTags(),
    submittedAt: new Date().toISOString(),
    source: `strategy-call-qualification|${EXPERIMENT.comboId}`
  };

  // -- Submitting state --
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  qualStatus.textContent = '';
  qualStatus.className = 'muted';

  try {
    const res = await fetch(QUALIFICATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }

    // -- Success state with booking CTA --
    const bookingUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent('Agent Business OS Strategy Call')
      + '&details=' + encodeURIComponent(
          '25-minute strategy call to discuss Agent Business OS implementation.\n\n'
          + 'Fit Score: ' + profile.fitScore + '/100\n'
          + 'Priority: ' + profile.priority.toUpperCase() + '\n'
          + 'Bottleneck: ' + profile.bottleneck + '\n'
          + 'Monthly Revenue: $' + profile.monthlyRevenue
        )
      + '&add=israel%40e5enclave.com&dur=0025';

    qualStatus.innerHTML = `
      <span style="color:var(--ok);font-weight:700;">✓ Qualification submitted!</span><br>
      Priority: <strong>${profile.priority.toUpperCase()}</strong> · Fit score: <strong>${profile.fitScore}/100</strong><br>
      <a href="${bookingUrl}" target="_blank" rel="noopener"
         class="btn" style="margin-top:.75rem;display:inline-block;">
        📅 Book Your Strategy Call Now
      </a><br>
      <span style="color:var(--muted);margin-top:.5rem;display:inline-block;">
        We'll also reach out to <strong>${document.getElementById('q_email').value}</strong> within ${profile.responseSlaMinutes} minutes.
      </span>
    `;
    qualStatus.className = 'qual-success';
    qualForm.reset();

  } catch (err) {
    // -- Error state with email fallback --
    const fallbackBody = encodeURIComponent(
      `Qualification Form Submission\n\n`
      + `Name: ${payload.name}\n`
      + `Email: ${payload.email}\n`
      + `Monthly Revenue: $${payload.monthlyRevenue}\n`
      + `Bottleneck: ${payload.bottleneck}\n`
      + `Desired Lift: $${payload.desiredLift}\n`
      + `Start in 7 Days: ${payload.canStartIn7Days}\n`
      + `Fit Score: ${payload.fitScore}\n`
      + `Priority: ${payload.priority}\n`
    );
    const mailto = `mailto:israel@e5enclave.com?subject=Qualification%20Request%20-%20${encodeURIComponent(payload.name)}&body=${fallbackBody}`;

    qualStatus.innerHTML = `
      <span style="color:#ff6b6b;font-weight:700;">⚠ Submission could not be completed</span><br>
      <span style="color:var(--muted);">${err.message}</span><br>
      <a href="${mailto}" style="color:var(--accent);text-decoration:underline;font-weight:600;">Click here to send via email instead →</a>
    `;
    qualStatus.className = 'qual-error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Qualification + Request Call';
  }
});

/* ── Mobile Nav Toggle ──────────────────────────────────────────────────── */

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile nav on link click
navLinks?.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
  });
});
