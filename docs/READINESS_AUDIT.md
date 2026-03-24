# Readiness Audit — Zero Human Business Landing

Date: 2026-03-24
Scope: lead intake, outbound lane, KPI telemetry, weekly memo, admin surface, API routes, deployment posture, CRM integration points, Google Ads grant readiness.

## 1) Operating surfaces found
- Public funnel + qualification: `/` (`index.html`, `script.js`)
- Lead intake API: `POST /api/lead`
- Admin lead dashboard: `/admin.html` + `GET /api/leads`
- KPI board: `/kpi.html` + `GET/POST /api/kpi`
- Outbound execution lane: `/outbound.html` + `outbound.js`
- Weekly decision memo: `GET /api/weekly-memo`
- Writing invoke lane: `POST /api/invoke`

## 2) Deployment status
- Azure Static Web App: `zero-human-landing` (Free SKU)
- Hostname: `purple-moss-015d42e0f.1.azurestaticapps.net`
- GitHub Actions deploy workflow: latest runs successful
- Anonymous endpoint smoke-test:
  - `/` => 200
  - `/api/lead` => reachable (400 on empty payload as expected)
  - `/api/kpi`, `/api/leads` => auth-gated by SWA role controls

## 3) Environment/secrets readiness
### Required (core lane)
- `LEADS_TABLE_CONNECTION_STRING`: set
- `LEADS_TABLE_NAME`: set (`inboundleads`)
- `ADMIN_DASHBOARD_KEY`: set
- `LEAD_SIGNATURE_MODE`: set (`optional`)
- `LEAD_SIGNATURE_SECRET`: set
- `LEAD_SIGNATURE_TOLERANCE_SEC`: set
- `WEEKLY_MEMO_TOKEN`: set

### Optional / lane-specific
- `KPI_TABLE_NAME`: missing (defaults to `dailykpi`) ✅ acceptable
- `LEAD_WEBHOOK_URL`: missing ⚠ CRM forwarding not active
- `LEAD_WEBHOOK_TOKEN`: missing ⚠ depends on webhook usage
- `TELEGRAM_BOT_TOKEN`: set
- `TELEGRAM_CHAT_ID`: set
- `TELEGRAM_THREAD_ID`: missing (optional)
- `WRITING_OPENAI_*`: set for Azure OpenAI invoke mode

## 4) Telemetry and KPI integrity
- Lead table integrity: `inboundleads` exists with data (10 rows observed in audit sample).
- KPI table integrity: `dailykpi` table not found (0 rows, missing table).
- Impact:
  - KPI board has no historical operating data yet.
  - Weekly memo can run, but cash/day and close-rate intelligence are underpowered until KPI rows are entered daily.

## 5) CRM integration points
Current available integration points (no new infra required):
1. Source-of-record ingestion: Azure Table (`inboundleads`).
2. Optional forwarder in `/api/lead`: `LEAD_WEBHOOK_URL` + `LEAD_WEBHOOK_TOKEN`.
3. Admin extraction lane: `/api/leads` + CSV export in `/admin.html`.

Recommended immediate CRM action:
- Attach `LEAD_WEBHOOK_URL` to existing Azure CRM intake endpoint from prior iteration to activate near-real-time sync.

## 6) Ad grant prerequisites / risks (legal-compliance posture)
Pre-launch prerequisites:
- Conversion tracking mapped to lead submission and qualified call events.
- UTM discipline preserved end-to-end (already implemented in lead payload tags).
- Policy-compliant ad and landing claims (no deceptive guarantees, clear offer language).
- Controlled keyword scope + negatives to protect traffic quality.

Key risks:
- Traffic without strict intent filtering can inflate low-quality leads and damage KPI signal.
- If grant policy requirements are missed, campaigns can be limited/suspended.
- Missing KPI rows will hide channel efficiency and undermine budget governance.

## 7) Minimal safe improvements applied in this cycle
1. **KPI API resilience fix**
   - Updated `api/kpi/index.js` to handle `TableNotFound` gracefully on read and return empty rows instead of 500.
2. **Automated readiness script**
   - Added `scripts/readiness_audit.sh` to audit deployment, settings presence, endpoint status, workflow health, and table counts.
3. **7-day execution plan**
   - Added `docs/GROWTH_SPRINT_7D.md` with daily KPIs and acceptance thresholds toward $1,000/day.

## 8) Immediate blockers
- KPI table has no records yet (measurement gap).
- CRM webhook forwarding is not configured (`LEAD_WEBHOOK_URL` absent).
- Grant launch readiness checklist must be completed before scaling traffic.

## 9) Command to rerun audit
```bash
./scripts/readiness_audit.sh
```
