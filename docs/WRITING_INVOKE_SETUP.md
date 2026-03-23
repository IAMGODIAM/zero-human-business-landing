Writing Invoke Setup

Purpose
- Connect this landing page's "Writing Engine Invoke" panel to a writing service/repo endpoint.

Supported modes
1) Generic Webhook
- Expects POST JSON payload
- Use this when your writing repo exposes a custom webhook endpoint

2) OpenAI-Compatible
- Expects POST /v1/chat/completions schema
- Returns text from choices[0].message.content

3) Architect's Voice (tRPC)
- Attempts POST to /api/trpc/generate.submit?batch=1
- Payload shape:
  {
    "0": {
      "json": {
        "documentType": "sales-letter",
        "topic": "...",
        "keyPoints": "...",
        "tone": "urgent_and_motivational"
      }
    }
  }

Notes for Architect's Voice
- May require authenticated browser session/cookie.
- If CORS blocks requests, proxy through a backend endpoint under the same domain.
- If procedure naming changes, update script.js mode=architects block.

Production recommendation
- Do not expose private API keys in frontend.
- Place secure invoke endpoint behind server middleware.
- Use short-lived tokens and audit logs.
