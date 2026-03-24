Lead Operations (Bespoke Azure)

Overview
- Lead intake endpoint: POST /api/lead
- Storage of record: Azure Table Storage (inboundleads)
- Admin retrieval endpoint: GET /api/leads
- Admin UI: /admin.html
- Optional downstream forwarding: LEAD_WEBHOOK_URL
- Optional real-time alerts: Telegram bot sendMessage

Security model
- /api/lead is anonymous (public form submission).
- /api/leads requires header x-admin-key matching ADMIN_DASHBOARD_KEY.
- Admin key is never embedded in frontend source.
- Admin enters key at runtime in /admin.html.

Required app settings
- LEADS_TABLE_CONNECTION_STRING
- LEADS_TABLE_NAME (default inboundleads)
- ADMIN_DASHBOARD_KEY

Optional app settings
- LEAD_WEBHOOK_URL
- LEAD_WEBHOOK_TOKEN
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
    TELEGRAM_BOT_TOKEN='123456:ABC...' \
    TELEGRAM_CHAT_ID='-1001234567890' \
    TELEGRAM_THREAD_ID='17585'

Admin usage
1) Open /admin.html
2) Enter admin key
3) Load leads
4) Filter by email/source
5) Export CSV when needed

Operational notes
- Lead is always persisted to table first.
- Webhook and Telegram failures do not block lead acceptance.
- API response includes forwarded and telegram booleans for diagnostics.
