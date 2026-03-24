const { TableClient } = require('@azure/data-tables');

function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function sanitize(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

function nowIso() {
  return new Date().toISOString();
}

async function storeInTable(payload) {
  const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
  const tableName = process.env.LEADS_TABLE_NAME || 'inboundleads';

  if (!conn) {
    throw new Error('LEADS_TABLE_CONNECTION_STRING not configured');
  }

  const client = TableClient.fromConnectionString(conn, tableName);
  await client.createTable().catch(() => {});

  const ts = Date.now();
  const rowKey = `${ts}-${Math.random().toString(36).slice(2, 10)}`;
  const partitionKey = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  const entity = {
    partitionKey,
    rowKey,
    name: sanitize(payload.name, 200),
    email: sanitize(payload.email, 320),
    company: sanitize(payload.company, 200),
    target: sanitize(payload.target, 200),
    stack: sanitize(payload.stack, 4000),
    utm: JSON.stringify(payload.utm || {}),
    source: sanitize(payload.source, 120),
    submittedAt: sanitize(payload.submittedAt, 40) || nowIso(),
    receivedAt: nowIso(),
    lane: 'agent-os-lead-table'
  };

  await client.createEntity(entity);
  return { leadId: `${partitionKey}/${rowKey}` };
}

async function forwardToWebhook(payload) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const webhookToken = process.env.LEAD_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    return { forwarded: false };
  }

  const headers = { 'content-type': 'application/json' };
  if (webhookToken) headers.authorization = `Bearer ${webhookToken}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      receivedAt: nowIso(),
      lane: 'agent-os-lead-webhook'
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`webhook failure ${response.status}: ${text.slice(0, 500)}`);
  }

  return { forwarded: true };
}

module.exports = async function (context, req) {
  try {
    const payload = req.body || {};
    if (!payload.email || !payload.name || !payload.stack) {
      return json(400, { ok: false, error: 'name, email, and stack are required' });
    }

    const stored = await storeInTable(payload);

    let forwardState = { forwarded: false };
    try {
      forwardState = await forwardToWebhook(payload);
    } catch (forwardError) {
      context.log.warn('lead webhook forward failed; stored locally', forwardError.message);
    }

    return json(200, {
      ok: true,
      message: 'lead accepted',
      storage: 'azure-table',
      leadId: stored.leadId,
      forwarded: forwardState.forwarded
    });
  } catch (error) {
    context.log.error('lead handler error', error);
    return json(500, { ok: false, error: error.message || 'internal_error' });
  }
};
