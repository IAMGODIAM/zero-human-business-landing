const { TableClient } = require('@azure/data-tables');
const crypto = require('crypto');

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

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortObjectDeep(value[k]);
    return out;
  }
  return value;
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function getHeader(req, name) {
  const headers = req.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
}

function verifyLeadSignature(req, payload) {
  const mode = (process.env.LEAD_SIGNATURE_MODE || 'optional').toLowerCase();
  const secret = process.env.LEAD_SIGNATURE_SECRET;

  if (!secret || mode === 'off') {
    return { ok: true, signed: false, reason: 'signature_off' };
  }

  const timestamp = String(getHeader(req, 'x-lead-timestamp') || '').trim();
  const signature = String(getHeader(req, 'x-lead-signature') || '').trim();

  const hasSignatureHeaders = Boolean(timestamp && signature);
  if (!hasSignatureHeaders && mode === 'optional') {
    return { ok: true, signed: false, reason: 'signature_optional_missing' };
  }

  if (!hasSignatureHeaders) {
    return { ok: false, reason: 'signature_required_missing' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'signature_invalid_timestamp' };
  }

  const toleranceSec = Math.max(Number(process.env.LEAD_SIGNATURE_TOLERANCE_SEC || 300), 30);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > toleranceSec) {
    return { ok: false, reason: 'signature_timestamp_out_of_range' };
  }

  const normalizedPayload = JSON.stringify(sortObjectDeep(payload || {}));
  const base = `${timestamp}.${normalizedPayload}`;
  const expectedHex = crypto.createHmac('sha256', secret).update(base).digest('hex');

  const givenHex = signature.replace(/^sha256=/i, '');
  if (!timingSafeEqualHex(expectedHex, givenHex)) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return { ok: true, signed: true, reason: 'signature_valid' };
}

async function storeInTable(payload, meta = {}) {
  const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
  const tableName = process.env.LEADS_TABLE_NAME || 'inboundleads';

  if (!conn) {
    throw new Error('LEADS_TABLE_CONNECTION_STRING not configured');
  }

  const client = TableClient.fromConnectionString(conn, tableName);
  await client.createTable().catch(() => {});

  const ts = Date.now();
  const rowKey = `${ts}-${Math.random().toString(36).slice(2, 10)}`;
  const partitionKey = new Date().toISOString().slice(0, 10);

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
    lane: 'agent-os-lead-table',
    signatureStatus: sanitize(meta.signatureStatus || 'unknown', 120)
  };

  await client.createEntity(entity);

  return {
    leadId: `${partitionKey}/${rowKey}`,
    partitionKey,
    rowKey,
    receivedAt: entity.receivedAt
  };
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

async function notifyTelegram(payload, stored) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_THREAD_ID;

  if (!token || !chatId) {
    return { notified: false, reason: 'telegram_not_configured' };
  }

  const lines = [
    'New Lead Captured',
    `Name: ${sanitize(payload.name, 120) || '-'}`,
    `Email: ${sanitize(payload.email, 200) || '-'}`,
    `Company: ${sanitize(payload.company, 120) || '-'}`,
    `Target: ${sanitize(payload.target, 120) || '-'}`,
    `Source: ${sanitize(payload.source, 120) || '-'}`,
    `Lead ID: ${stored.leadId}`,
    `Received: ${stored.receivedAt}`
  ];

  const body = {
    chat_id: chatId,
    text: lines.join('\n'),
    disable_web_page_preview: true
  };
  if (threadId) body.message_thread_id = Number(threadId);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`telegram failure ${res.status}: ${text.slice(0, 500)}`);
  }

  return { notified: true };
}

module.exports = async function (context, req) {
  try {
    const payload = req.body || {};
    if (!payload.email || !payload.name || !payload.stack) {
      return json(400, { ok: false, error: 'name, email, and stack are required' });
    }

    const sig = verifyLeadSignature(req, payload);
    if (!sig.ok) {
      return json(401, { ok: false, error: sig.reason });
    }

    const stored = await storeInTable(payload, { signatureStatus: sig.reason });

    let forwardState = { forwarded: false };
    try {
      forwardState = await forwardToWebhook(payload);
    } catch (forwardError) {
      context.log.warn('lead webhook forward failed; stored locally', forwardError.message);
    }

    let telegramState = { notified: false };
    try {
      telegramState = await notifyTelegram(payload, stored);
    } catch (telegramError) {
      context.log.warn('telegram notify failed', telegramError.message);
    }

    return json(200, {
      ok: true,
      message: 'lead accepted',
      storage: 'azure-table',
      leadId: stored.leadId,
      forwarded: forwardState.forwarded,
      telegram: telegramState.notified,
      signed: sig.signed
    });
  } catch (error) {
    context.log.error('lead handler error', error);
    return json(500, { ok: false, error: error.message || 'internal_error' });
  }
};
