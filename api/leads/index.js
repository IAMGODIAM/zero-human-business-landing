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

module.exports = async function (context, req) {
  try {
    const expected = process.env.ADMIN_DASHBOARD_KEY;
    const provided = String(getAdminKey(req) || '').trim();
    if (!expected) return json(503, { ok: false, error: 'ADMIN_DASHBOARD_KEY not configured' });
    if (!provided || provided !== expected) return json(401, { ok: false, error: 'unauthorized' });

    const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
    const tableName = process.env.LEADS_TABLE_NAME || 'inboundleads';
    if (!conn) return json(503, { ok: false, error: 'LEADS_TABLE_CONNECTION_STRING not configured' });

    const limit = Math.min(Number(req.query.limit || 100), 500);
    const emailContains = String(req.query.email || '').toLowerCase();
    const sourceContains = String(req.query.source || '').toLowerCase();

    const client = TableClient.fromConnectionString(conn, tableName);
    const items = [];

    for await (const e of client.listEntities()) {
      const lead = {
        leadId: `${e.partitionKey}/${e.rowKey}`,
        partitionKey: e.partitionKey,
        rowKey: e.rowKey,
        name: e.name || '',
        email: e.email || '',
        company: e.company || '',
        target: e.target || '',
        stack: e.stack || '',
        source: e.source || '',
        formType: e.formType || 'general',
        priority: e.priority || 'nurture',
        stage: e.stage || 'new',
        status: e.status || 'open',
        outreachStatus: e.outreachStatus || 'pending',
        lifecycleUpdatedAt: e.lifecycleUpdatedAt || e.receivedAt || '',
        fitScore: Number.isFinite(Number(e.fitScore)) ? Number(e.fitScore) : 0,
        responseSlaMinutes: Number.isFinite(Number(e.responseSlaMinutes)) ? Number(e.responseSlaMinutes) : 240,
        receivedAt: e.receivedAt || '',
        submittedAt: e.submittedAt || '',
        utm: (() => {
          try { return JSON.parse(e.utm || '{}'); } catch { return {}; }
        })()
      };

      if (emailContains && !String(lead.email).toLowerCase().includes(emailContains)) continue;
      if (sourceContains && !String(lead.source).toLowerCase().includes(sourceContains)) continue;

      items.push(lead);
      if (items.length >= 2000) break;
    }

    items.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
    const leads = items.slice(0, limit);

    return json(200, { ok: true, count: leads.length, leads });
  } catch (error) {
    context.log.error('leads list error', error);
    return json(500, { ok: false, error: 'internal_error' });
  }
};
