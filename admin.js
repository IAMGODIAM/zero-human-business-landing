let latestLeads = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function asDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

function toCsv(rows) {
  const headers = ['receivedAt','name','email','company','target','source','utm','stack','leadId'];
  const esc = (x) => `"${String(x || '').replaceAll('"', '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(','));
  }
  return lines.join('\n');
}

async function loadLeads() {
  const status = $('status');
  const key = $('adminKey').value.trim();
  if (!key) {
    status.textContent = 'Enter admin key first.';
    return;
  }

  status.textContent = 'Loading...';
  const emailFilter = $('emailFilter').value.trim();
  const sourceFilter = $('sourceFilter').value.trim();

  const params = new URLSearchParams({ limit: '200' });
  if (emailFilter) params.set('email', emailFilter);
  if (sourceFilter) params.set('source', sourceFilter);

  try {
    const res = await fetch(`/api/leads?${params.toString()}`, {
      headers: { 'x-admin-key': key }
    });

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!res.ok) {
      status.textContent = `Load failed (${res.status}): ${data.error || text}`;
      return;
    }

    latestLeads = data.leads || [];
    const rows = latestLeads.map((r) => `
      <tr>
        <td>${escapeHtml(asDate(r.receivedAt))}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.company)}</td>
        <td>${escapeHtml(r.target)}</td>
        <td><span class="pill">${escapeHtml(r.source || '-')}</span></td>
        <td class="small">${escapeHtml(JSON.stringify(r.utm || {}))}</td>
        <td class="small">${escapeHtml(r.stack)}</td>
        <td class="small">${escapeHtml(r.leadId)}</td>
      </tr>
    `).join('');

    $('rows').innerHTML = rows || '<tr><td colspan="9">No leads found.</td></tr>';
    status.textContent = `Loaded ${latestLeads.length} leads.`;
    localStorage.setItem('lead_admin_key', key);
  } catch (err) {
    status.textContent = `Load error: ${err.message}`;
  }
}

function exportCsv() {
  if (!latestLeads.length) {
    $('status').textContent = 'No leads loaded to export.';
    return;
  }
  const csv = toCsv(latestLeads);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$('loadBtn').addEventListener('click', loadLeads);
$('csvBtn').addEventListener('click', exportCsv);
$('adminKey').value = localStorage.getItem('lead_admin_key') || '';
