function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function chooseEndpoint(mode) {
  if (mode === 'openai') {
    return {
      endpoint: process.env.WRITING_OPENAI_URL,
      token: process.env.WRITING_OPENAI_TOKEN,
      provider: process.env.WRITING_OPENAI_PROVIDER || 'openai'
    };
  }
  if (mode === 'architects') {
    return {
      endpoint: process.env.WRITING_ARCHITECTS_URL,
      token: process.env.WRITING_ARCHITECTS_TOKEN
    };
  }
  return {
    endpoint: process.env.WRITING_WEBHOOK_URL,
    token: process.env.WRITING_WEBHOOK_TOKEN
  };
}

function parseArchitectsResponse(jsonBody) {
  if (jsonBody?.[0]?.result?.data?.json?.generatedText) return jsonBody[0].result.data.json.generatedText;
  if (jsonBody?.result?.data?.json?.generatedText) return jsonBody.result.data.json.generatedText;
  if (jsonBody?.generatedText) return jsonBody.generatedText;
  return JSON.stringify(jsonBody, null, 2);
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
    const mode = body.mode || 'webhook';
    const profile = body.profile || 'default';
    const docType = String(body.docType || 'sales-letter').slice(0, 120);
    const topic = String(body.topic || '').slice(0, 6000);
    const keyPoints = String(body.keyPoints || '').slice(0, 6000);

    if (!topic) {
      return json(400, { ok: false, error: 'topic is required' });
    }

    const { endpoint, token, provider } = chooseEndpoint(mode);
    if (!endpoint) {
      return json(503, { ok: false, error: `endpoint not configured for mode=${mode}` });
    }

    const headers = { 'content-type': 'application/json' };

    let url = endpoint;
    let payload;

    if (mode === 'openai') {
      const isAzure = provider === 'azure';
      if (isAzure) {
        const deployment = process.env.WRITING_OPENAI_DEPLOYMENT || 'gpt-4o';
        const apiVersion = process.env.WRITING_OPENAI_API_VERSION || '2024-10-21';
        url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
        if (token) headers['api-key'] = token;
      } else {
        if (!/\/chat\/completions$/.test(url)) {
          url = url.replace(/\/$/, '') + '/chat/completions';
        }
        if (token) headers.authorization = `Bearer ${token}`;
      }

      payload = {
        ...(provider === 'azure' ? {} : { model: process.env.WRITING_OPENAI_MODEL || 'gpt-4o-mini' }),
        messages: [
          { role: 'system', content: 'You are a conversion copywriter for AI automation services.' },
          { role: 'user', content: `Profile: ${profile}\nDocument type: ${docType}\nTopic: ${topic}\nKey points: ${keyPoints}` }
        ]
      };
    } else if (mode === 'architects') {
      if (token) headers.authorization = `Bearer ${token}`;
      if (!url.includes('/api/trpc/generate.submit')) {
        url = url.replace(/\/$/, '') + '/api/trpc/generate.submit?batch=1';
      }
      payload = {
        0: {
          json: {
            documentType: docType,
            topic,
            keyPoints,
            tone: 'urgent_and_motivational'
          }
        }
      };
    } else {
      if (token) headers.authorization = `Bearer ${token}`;
      payload = {
        task: 'write_asset',
        profile,
        documentType: docType,
        topic,
        keyPoints,
        source: 'zero-human-business-landing',
        invokedAt: new Date().toISOString()
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let jsonBody = null;
    try { jsonBody = JSON.parse(text); } catch {}

    if (!response.ok) {
      context.log.error('invoke upstream failed', mode, response.status, text);
      return json(502, { ok: false, error: `upstream failure ${response.status}`, detail: text.slice(0, 1000) });
    }

    if (mode === 'openai') {
      const output = jsonBody?.choices?.[0]?.message?.content || text;
      return json(200, { ok: true, mode, output });
    }

    if (mode === 'architects') {
      const output = jsonBody ? parseArchitectsResponse(jsonBody) : text;
      return json(200, { ok: true, mode, output });
    }

    return json(200, { ok: true, mode, output: jsonBody || text });
  } catch (error) {
    context.log.error('invoke handler error', error);
    return json(500, { ok: false, error: 'internal_error' });
  }
};
