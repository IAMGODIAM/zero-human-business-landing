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
  };

  const fallbackBody = encodeURIComponent(JSON.stringify(payload, null, 2));
  const mailto = `mailto:israel@e5enclave.com?subject=Agent%20OS%20Build%20Request&body=${fallbackBody}`;

  leadStatus.textContent = 'Build request prepared. Opening email draft...';
  window.location.href = mailto;
});

const invokeForm = document.getElementById('invokeForm');
const invokeOutput = document.getElementById('invokeOutput');

function parseArchitectsResponse(json) {
  if (json?.[0]?.result?.data?.json?.generatedText) return json[0].result.data.json.generatedText;
  if (json?.result?.data?.json?.generatedText) return json.result.data.json.generatedText;
  if (json?.generatedText) return json.generatedText;
  return JSON.stringify(json, null, 2);
}

invokeForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const mode = document.getElementById('invokeMode').value;
  const endpoint = document.getElementById('invokeEndpoint').value.trim();
  const token = document.getElementById('invokeToken').value.trim();
  const docType = document.getElementById('docType').value.trim();
  const topic = document.getElementById('topic').value.trim();
  const keyPoints = document.getElementById('keyPoints').value.trim();

  if (!endpoint) {
    invokeOutput.textContent = 'Add an endpoint URL first.';
    return;
  }

  let url = endpoint;
  let body = null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (mode === 'openai') {
    body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a conversion copywriter for AI automation services.' },
        { role: 'user', content: `Document type: ${docType}\nTopic: ${topic}\nKey points: ${keyPoints}` }
      ]
    };
  } else if (mode === 'architects') {
    if (!url.includes('/api/trpc/generate.submit')) {
      url = url.replace(/\/$/, '') + '/api/trpc/generate.submit?batch=1';
    }
    body = {
      0: {
        json: {
          documentType: docType || 'sales-letter',
          topic,
          keyPoints,
          tone: 'urgent_and_motivational'
        }
      }
    };
  } else {
    body = {
      task: 'write_asset',
      documentType: docType,
      topic,
      keyPoints,
      source: 'zero-human-business-landing'
    };
  }

  invokeOutput.textContent = 'Invoking...';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: mode === 'architects' ? 'include' : 'same-origin'
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      invokeOutput.textContent = `Invoke failed (${res.status})\n\n${text}`;
      return;
    }

    if (mode === 'openai' && json?.choices?.[0]?.message?.content) {
      invokeOutput.textContent = json.choices[0].message.content;
      return;
    }

    if (mode === 'architects') {
      invokeOutput.textContent = parseArchitectsResponse(json);
      return;
    }

    invokeOutput.textContent = json ? JSON.stringify(json, null, 2) : text;
  } catch (err) {
    invokeOutput.textContent = `Invoke error: ${err.message}`;
  }
});
