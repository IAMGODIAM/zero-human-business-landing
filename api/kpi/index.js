const { TableClient } = require('@azure/data-tables');

function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function getAdminKey(req) {
  const h = req.headers || {};
  return h['x-admin-key'] || h['X-Admin-Key'] || (h.authorization || '').replace(/^Bearer\s+/i, '');
}

function getClient() {
  const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
  const tableName = process.env.KPI_TABLE_NAME || 'dailykpi';
  if (!conn) throw new Error('LEADS_TABLE_CONNECTION_STRING not configured');
  return TableClient.fromConnectionString(conn, tableName);
}

function normalizeDate(raw) {
  const v = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  return v;
}

async function saveRow(body) {
  const date = normalizeDate(body.date);
  if (!date) throw new Error('invalid_date');

  const client = getClient();
  await client.createTable().catch(() => {});

  const rowKey = String(Date.now());
  const entity = {
    partitionKey: date,
    rowKey,
    date,
    cash: Number(body.cash || 0),
    callsBooked: Number(body.callsBooked || 0),
    callsHeld: Number(body.callsHeld || 0),
    dealsClosed: Number(body.dealsClosed || 0),
    spend: Number(body.spend || 0),
    savedAt: new Date().toISOString()
  };

  await client.createEntity(entity);
  return entity;
}

async function listRows(limit = 60) {
  const client = getClient();
  const rows = [];

  try {
    for await (const e of client.listEntities()) {
      rows.push({
        date: e.date || e.partitionKey,
        cash: Number(e.cash || 0),
        callsBooked: Number(e.callsBooked || 0),
        callsHeld: Number(e.callsHeld || 0),
        dealsClosed: Number(e.dealsClosed || 0),
        spend: Number(e.spend || 0),
        savedAt: e.savedAt || '',
        id: `${e.partitionKey}/${e.rowKey}`
      });
      if (rows.length >= 3000) break;
    }
  } catch (error) {
    const msg = String(error && error.message ? error.message : error);
    if (msg.includes('TableNotFound')) return [];
    throw error;
  }

  rows.sort((a, b) => {
    const d = String(b.date).localeCompare(String(a.date));
    if (d !== 0) return d;
    return String(b.savedAt).localeCompare(String(a.savedAt));
  });

  const latestByDate = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.date)) continue;
    seen.add(row.date);
    latestByDate.push(row);
    if (latestByDate.length >= limit) break;
  }

  return latestByDate;
}

module.exports = async function (context, req) {
  try {
    const expected = process.env.ADMIN_DASHBOARD_KEY;
    const provided = String(getAdminKey(req) || '').trim();
    if (!expected) return json(503, { ok: false, error: 'ADMIN_DASHBOARD_KEY not configured' });
    if (!provided || provided !== expected) return json(401, { ok: false, error: 'unauthorized' });

    if (req.method === 'POST') {
      const entity = await saveRow(req.body || {});
      return json(200, { ok: true, row: entity });
    }

    const limit = Math.min(Number((req.query || {}).limit || 60), 180);
    const rows = await listRows(limit);
    return json(200, { ok: true, count: rows.length, rows });
  } catch (error) {
    context.log.error('kpi handler error', error);
    return json(500, { ok: false, error: error.message || 'internal_error' });
  }
};
