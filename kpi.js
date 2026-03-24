const kpiForm = document.getElementById('kpiForm');
const kpiStatus = document.getElementById('kpiStatus');
const kpiRows = document.getElementById('kpiRows');
const kpiSummary = document.getElementById('kpiSummary');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
}

function escapeHtml(s) {
  return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function readKey() {
  return (document.getElementById('kpi_key').value || '').trim();
}

async function loadKpi() {
  const key = readKey();
  if (!key) {
    kpiStatus.textContent = 'Enter admin key first.';
    return;
  }

  const res = await fetch('/api/kpi?limit=60', { headers: { 'x-admin-key': key } });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    kpiStatus.textContent = `Load failed (${res.status}): ${data.error || text}`;
    return;
  }

  const rows = data.rows || [];
  const lines = rows.map((r) => {
    const held = Number(r.callsHeld || 0);
    const closeRate = held ? ((Number(r.dealsClosed || 0) / held) * 100).toFixed(1) + '%' : '0.0%';
    return `<tr>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(r.date)}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(money(r.cash))}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(r.callsBooked)}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(r.callsHeld)}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(r.dealsClosed)}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(money(r.spend))}</td>
      <td style="padding:.45rem; border-bottom:1px solid #213145;">${escapeHtml(closeRate)}</td>
    </tr>`;
  });

  kpiRows.innerHTML = lines.join('') || '<tr><td colspan="7" style="padding:.45rem;">No KPI rows yet.</td></tr>';

  const recent = rows.slice(0, 14);
  const totals = recent.reduce((acc, r) => {
    acc.cash += Number(r.cash || 0);
    acc.booked += Number(r.callsBooked || 0);
    acc.held += Number(r.callsHeld || 0);
    acc.closed += Number(r.dealsClosed || 0);
    acc.spend += Number(r.spend || 0);
    return acc;
  }, { cash: 0, booked: 0, held: 0, closed: 0, spend: 0 });

  const days = Math.max(1, recent.length);
  const cashPerDay = totals.cash / days;
  const closeRate = totals.held ? ((totals.closed / totals.held) * 100).toFixed(1) : '0.0';
  kpiSummary.textContent = `Avg cash/day: ${money(cashPerDay)} | Calls booked: ${totals.booked} | Close rate (held): ${closeRate}% | Net cash: ${money(totals.cash - totals.spend)}`;
  localStorage.setItem('kpi_admin_key', key);
}

kpiForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = readKey();
  if (!key) {
    kpiStatus.textContent = 'Enter admin key first.';
    return;
  }

  const payload = {
    date: document.getElementById('kpi_date').value,
    cash: Number(document.getElementById('kpi_cash').value || 0),
    callsBooked: Number(document.getElementById('kpi_booked').value || 0),
    callsHeld: Number(document.getElementById('kpi_held').value || 0),
    dealsClosed: Number(document.getElementById('kpi_closed').value || 0),
    spend: Number(document.getElementById('kpi_spend').value || 0)
  };

  const res = await fetch('/api/kpi', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    kpiStatus.textContent = `Save failed (${res.status}): ${data.error || text}`;
    return;
  }

  kpiStatus.textContent = `Saved KPI row for ${payload.date}.`;
  await loadKpi();
});

document.getElementById('kpi_date').value = todayISO();
document.getElementById('kpi_key').value = localStorage.getItem('kpi_admin_key') || '';
document.getElementById('kpiLoadBtn').addEventListener('click', loadKpi);
