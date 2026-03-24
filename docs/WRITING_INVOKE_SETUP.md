Writing Invoke Setup (Production)

Purpose
- Connect the landing page to secure backend API routes so secrets stay server-side.

Architecture
- Frontend calls same-origin routes:
  - POST /api/lead
  - POST /api/invoke
- Azure Static Web Apps Functions forward requests to configured upstream services.

API Routes
1) /api/lead
- Forwards lead payload to LEAD_WEBHOOK_URL
- Optional auth header via LEAD_WEBHOOK_TOKEN

2) /api/invoke
- Supports modes: webhook, openai, architects
- Uses server-side environment variables per mode

Required Azure app settings
- LEADS_TABLE_CONNECTION_STRING (required for bespoke lead capture)
- LEADS_TABLE_NAME (default inboundleads)
- LEAD_WEBHOOK_URL (optional downstream forwarding)
- LEAD_WEBHOOK_TOKEN (optional)
- WRITING_WEBHOOK_URL
- WRITING_WEBHOOK_TOKEN (optional)
- WRITING_OPENAI_PROVIDER (openai|azure)
- WRITING_OPENAI_URL
- WRITING_OPENAI_TOKEN
- WRITING_OPENAI_MODEL (optional, openai mode only)
- WRITING_OPENAI_DEPLOYMENT (azure mode only)
- WRITING_OPENAI_API_VERSION (azure mode only)
- WRITING_ARCHITECTS_URL
- WRITING_ARCHITECTS_TOKEN (optional)

Set settings (example)
az staticwebapp appsettings set \
  --name zero-human-landing \
  --resource-group nerve-center-rg \
  --setting-names \
    LEADS_TABLE_CONNECTION_STRING='DefaultEndpointsProtocol=...;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net' \
    LEADS_TABLE_NAME='inboundleads' \
    LEAD_WEBHOOK_URL='https://YOUR_LEAD_WEBHOOK' \
    LEAD_WEBHOOK_TOKEN='YOUR_LEAD_TOKEN' \
    WRITING_WEBHOOK_URL='https://YOUR_WRITING_WEBHOOK' \
    WRITING_WEBHOOK_TOKEN='YOUR_WRITING_WEBHOOK_TOKEN' \
    WRITING_OPENAI_PROVIDER='azure' \
    WRITING_OPENAI_URL='https://YOUR_AZURE_OPENAI_RESOURCE.openai.azure.com' \
    WRITING_OPENAI_TOKEN='YOUR_AZURE_OPENAI_KEY' \
    WRITING_OPENAI_DEPLOYMENT='gpt-4o' \
    WRITING_OPENAI_API_VERSION='2024-10-21' \
    WRITING_ARCHITECTS_URL='https://YOUR_ARCHITECTS_VOICE_BASE' \
    WRITING_ARCHITECTS_TOKEN='YOUR_ARCHITECTS_TOKEN'

Notes
- If architects endpoint requires cookie-auth, use a service token or backend adapter.
- Do not put private keys in frontend fields.
- If an upstream endpoint is not configured, API returns 503 with mode-specific message.
