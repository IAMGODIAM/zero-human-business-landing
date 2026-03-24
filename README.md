Autonomous Revenue OS - Landing Page v2

Live URL
- https://purple-moss-015d42e0f.1.azurestaticapps.net

Repository
- https://github.com/IAMGODIAM/zero-human-business-landing

What is included
- index.html: advanced one-page site for agent-run business offer (includes qualification call form)
- styles.css: responsive design system
- script.js: interactive logic (ROI calculator, 5x2 experiment assignment, attribution tagging, secure lead + qualification intake, writing invoke panel)
- outbound.html + outbound.js: authenticated outbound lane tracker (50 contacts/day discipline)
- kpi.html + kpi.js: authenticated KPI board for cash/day and conversion metrics
- api/: Azure Static Web Apps Functions backend routes
  - /api/lead (bespoke Azure Table intake + optional webhook forward + optional Telegram alert)
  - /api/leads (admin-only lead listing endpoint)
  - /api/kpi (admin-only KPI entry/list endpoint)
  - /api/invoke (secure writing proxy)
  - /api/weekly-memo (token-gated weekly winner/loser decision memo)
- admin.html + admin.js: secure lead dashboard and CSV export
- staticwebapp.config.json: route protection + security headers
- docs/AGENT_BUSINESS_OS.md: operating charter for autonomous business execution
- docs/WRITING_INVOKE_SETUP.md: production integration notes for writing repo invocation
- docs/LEAD_OPERATIONS.md: lead storage/admin/alert operations guide
- docs/GROWTH_BLOCK_OPERATIONS.md: daily growth operating cadence toward $1k/day
- docs/CHANNEL_SWARM_BLOCK3.md: multi-channel swarm operating charter (LinkedIn/email/X/referral)
- docs/templates/: LinkedIn post bank, email outbound scripts, and channel scorecard template

Advanced features
1) 30-day Agent Business OS rollout section
2) ROI forecaster with instant monthly impact estimate
3) Built-in Writing Engine Invoke panel via secure backend proxy
4) Lead capture form with UTM preservation and Azure Table persistence
5) Admin lead dashboard (/admin.html) with filter + CSV export
6) Optional Telegram notifications for new lead events
7) Improved navigation, KPI strip, and structured conversion architecture

Local preview
- Open index.html directly in browser
or
- python3 -m http.server 8080
- visit http://localhost:8080

Deployment (Azure Static Web Apps)
- Connected to GitHub main branch via Actions workflow.
- Every push to main auto-deploys.
- API routes in /api are deployed with the site.
- Configure production secrets via `az staticwebapp appsettings set` (see docs/WRITING_INVOKE_SETUP.md).

Quick customization checklist
- Replace brand + contact email
- Point lead form to production webhook/CRM endpoint
- Add Calendly or direct booking endpoint
- Add real proof: logos, outcomes, testimonials
- Map custom domain and SSL in Azure portal

Strategic note
- This site is the top-of-funnel vehicle.
- Core advantage remains your operating system quality and iteration cadence.
- Keep one ICP, one promise, one primary CTA until conversion data says expand.
