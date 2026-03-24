Lead Operations (Bespoke Azure)

Overview
- Lead intake endpoint: POST /api/lead
- Storage of record: Azure Table Storage (inboundleads)
- Admin retrieval endpoint: GET /api/leads
- Admin UI: /admin.html
- Optional downstream forwarding: LEAD_WEBHOOK_URL
- Optional real-time alerts: Telegram bot sendMessage

Security model
- /api/lead is anonymous for public forms, with optional HMAC signature verification controls.
- /admin.html and /api/leads are restricted to SWA authenticated users via staticwebapp.config.json.
- /api/leads also requires header x-admin-key matching ADMIN_DASHBOARD_KEY (defense in depth).
- Admin key is never embedded in frontend source.
- Admin enters key at runtime in /admin.html.

Required app settings
- LEADS_TABLE_CONNECTION_STRING
- LEADS_TABLE_NAME (default inboundleads)
- ADMIN_DASHBOARD_KEY

Optional app settings
- LEAD_WEBHOOK_URL
- LEAD_WEBHOOK_TOKEN
- LEAD_SIGNATURE_MODE (off|optional|required; default optional)
- LEAD_SIGNATURE_SECRET (required if mode is optional/required)
- LEAD_SIGNATURE_TOLERANCE_SEC (default 300)
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- TELEGRAM_THREAD_ID (optional Telegram topic/thread)

Telegram setup steps
1) Create bot via BotFather and copy bot token.
2) Add bot to your target chat/channel.
3) Obtain chat id.
4) Set:
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - (optional) TELEGRAM_THREAD_ID

Set/update settings
az staticwebapp appsettings set \
  --name zero-human-landing \
  --resource-group nerve-center-rg \
  --setting-names \
    ADMIN_DASHBOARD_KEY='YOUR_STRONG_KEY' \
    LEAD_SIGNATURE_MODE='optional' \
    LEAD_SIGNATURE_SECRET='YOUR_HMAC_SECRET' \
    LEAD_SIGNATURE_TOLERANCE_SEC='300' \
    TELEGRAM_BOT_TOKEN='123456:ABC...' \
    TELEGRAM_CHAT_ID='-1001234567890' \
    TELEGRAM_THREAD_ID='17585'

Admin usage
1) Open /admin.html
2) Enter admin key
3) Load leads
4) Filter by email/source
5) Export CSV when needed

Signature format (when using signed submissions)
- Headers:
  - x-lead-timestamp: unix epoch seconds
  - x-lead-signature: sha256=<hex_hmac>
- HMAC base string:
  - `${timestamp}.${JSON.stringify(sorted_payload)}`
- Algorithm: HMAC-SHA256 with LEAD_SIGNATURE_SECRET

Operational notes
- Lead is always persisted to table first after signature gate passes.
- Webhook and Telegram failures do not block lead acceptance.
- API response includes forwarded, telegram, and signed booleans for diagnostics.
