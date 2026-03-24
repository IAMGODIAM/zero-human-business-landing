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
    utm: getUTM(),
    submittedAt: new Date().toISOString(),
    source: 'zero-human-business-landing'
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

const qualForm = document.getElementById('qualForm');
const qualStatus = document.getElementById('qualStatus');

qualForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: document.getElementById('q_name').value,
    email: document.getElementById('q_email').value,
    company: 'Qualification Form',
    target: `$${document.getElementById('q_lift').value} monthly lift`,
    stack: JSON.stringify({
      form: 'qualification',
      monthlyRevenue: Number(document.getElementById('q_revenue').value || 0),
      bottleneck: document.getElementById('q_bottleneck').value,
      canStartIn7Days: document.getElementById('q_start').value
    }),
    utm: getUTM(),
    submittedAt: new Date().toISOString(),
    source: 'strategy-call-qualification'
  };

  qualStatus.textContent = 'Submitting qualification...';

  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const parsed = await safeJson(res);
    if (!res.ok) throw new Error(parsed.raw || `HTTP ${res.status}`);

    qualStatus.textContent = 'Qualified request received. We will send your call options shortly.';
    qualForm.reset();
  } catch (err) {
    qualStatus.textContent = `Qualification intake unavailable (${err.message}). Use build request form below.`;
  }
});

const invokeForm = document.getElementById('invokeForm');
const invokeOutput = document.getElementById('invokeOutput');

invokeForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const mode = document.getElementById('invokeMode').value;
  const profile = document.getElementById('invokeProfile').value;
  const docType = document.getElementById('docType').value.trim();
  const topic = document.getElementById('topic').value.trim();
  const keyPoints = document.getElementById('keyPoints').value.trim();

  invokeOutput.textContent = 'Invoking secure backend...';

  try {
    const res = await fetch('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, profile, docType, topic, keyPoints })
    });

    const parsed = await safeJson(res);
    if (!res.ok) {
      invokeOutput.textContent = `Invoke failed (${res.status})\n\n${parsed.raw}`;
      return;
    }

    const output = parsed.data?.output || parsed.data?.text || parsed.raw;
    invokeOutput.textContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
  } catch (err) {
    invokeOutput.textContent = `Invoke error: ${err.message}`;
  }
});
