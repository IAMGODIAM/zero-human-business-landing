function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

module.exports = async function (context, req) {
  try {
    const payload = req.body || {};
    if (!payload.email || !payload.name || !payload.stack) {
      return json(400, { ok: false, error: 'name, email, and stack are required' });
    }

    const webhookUrl = process.env.LEAD_WEBHOOK_URL;
    const webhookToken = process.env.LEAD_WEBHOOK_TOKEN;

    if (!webhookUrl) {
      return json(503, { ok: false, error: 'LEAD_WEBHOOK_URL not configured' });
    }

    const headers = { 'content-type': 'application/json' };
    if (webhookToken) headers.authorization = `Bearer ${webhookToken}`;

    const forward = {
      ...payload,
      receivedAt: new Date().toISOString(),
      lane: 'agent-os-lead'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(forward)
    });

    const text = await response.text();
    if (!response.ok) {
      context.log.error('lead webhook failed', response.status, text);
      return json(502, { ok: false, error: `upstream failure ${response.status}` });
    }

    return json(200, { ok: true, message: 'lead accepted' });
  } catch (error) {
    context.log.error('lead handler error', error);
    return json(500, { ok: false, error: 'internal_error' });
  }
};
