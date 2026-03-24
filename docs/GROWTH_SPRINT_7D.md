# Growth Sprint 7D — Path to $1,000/day (Zero Human Business)

## Sprint objective (7 days)
Reach an **evidence-backed operating posture** where the system can repeatedly produce:
- **$1,000/day cash run-rate** (rolling 3-day average)
- with **low cash burn** (cash spend <= $50/day, excluding granted ad credit)
- and full measurement traceability (attributed leads + KPI rows + weekly memo inputs)

## Constraints
- Legal/compliant execution only.
- No new paid subscriptions or spend commitments.
- Prioritize existing infrastructure: Azure Static Web App + Azure Tables + Google Ads grant credit.
- Reuse existing CRM integration pattern (`LEAD_WEBHOOK_URL`) before building new CRM components.

## KPI spine for this sprint
Primary daily KPIs:
- Cash collected ($)
- Calls booked
- Calls held
- Deals closed
- Spend ($ cash)
- Net cash ($cash - $spend)

Derived guardrail KPIs:
- Reply rate = replies / outbound sent
- Booked rate = calls booked / outbound sent
- Close rate (held) = deals closed / calls held
- Qualified lead attribution coverage = leads with `utm.exp_combo` / total leads

## Acceptance thresholds (must hold by Day 7)
- Outbound discipline: **>= 50 targeted contacts/day** (5 of 7 days)
- Reply rate: **>= 3%**
- Booked-call rate: **>= 1.5%**
- Close rate (held): **>= 20%**
- Attribution coverage: **>= 90%** of new leads
- KPI freshness: KPI row posted **daily by 09:00 local**
- Run-rate target: **>= $1,000/day rolling-3 average** OR quantified gap with a funded plan using grant credit only

## Day-by-day execution plan

### Day 1 — Instrumentation hardening + baseline lock
**Actions**
1. Run `scripts/readiness_audit.sh` and archive output in ops notes.
2. Confirm app settings for lead intake + memo token + writing proxy.
3. Validate `/api/lead` success path and one end-to-end test lead.
4. Enter baseline KPI row (cash/booked/held/closed/spend).

**Daily KPI targets**
- Outbound sent >= 50
- Attribution coverage >= 90%
- KPI row saved: yes

**Acceptance to pass Day 1**
- No unknown missing required settings.
- Lead ingestion confirmed in Azure Table.

---

### Day 2 — Outbound quality lift (copy + targeting)
**Actions**
1. Execute 50 ICP-true contacts (email/LinkedIn/X mix).
2. Use one opener script for all sends (single-variable test).
3. Log reply/booked outcomes in outbound board and KPI board.

**Daily KPI targets**
- Reply rate >= 3%
- Booked rate >= 1.5%
- Spend cash <= $20

**Acceptance to pass Day 2**
- One script variant clearly tracked against outcomes.

---

### Day 3 — Qualification tightening
**Actions**
1. Review Day 1-2 inbound quality from `/admin.html` + source tags.
2. Tighten qualification copy (target lift clarity + start window clarity) if low intent appears.
3. Run normal outbound block and KPI logging.

**Daily KPI targets**
- Qualified lead ratio improves vs Day 1 baseline.
- Calls booked >= 1

**Acceptance to pass Day 3**
- At least one qualification bottleneck identified and fixed.

---

### Day 4 — CRM lane activation (existing Azure components)
**Actions**
1. Connect `LEAD_WEBHOOK_URL` to existing Azure CRM ingestion endpoint (if available).
2. Validate dual-write behavior: Azure Table persists + webhook forwards.
3. Add fallback handling note in ops docs.

**Daily KPI targets**
- 100% of new leads appear in source-of-record table.
- Forwarding success observed in at least one test event.

**Acceptance to pass Day 4**
- CRM forwarding path live OR explicitly documented blocker with owner and ETA.

---

### Day 5 — Grant-powered top-funnel launch prep (no extra cash spend)
**Actions**
1. Build Google Ads grant campaign skeleton aligned to single ICP + single offer.
2. Ensure policy-safe ad copy, compliant landing content, and conversion tags/UTM.
3. Define keyword negatives and geo filters to protect quality.

**Daily KPI targets**
- Campaign/ad group/keyword structure complete.
- Conversion event mapping documented.

**Acceptance to pass Day 5**
- Ready-to-launch checklist complete with compliance checks.

---

### Day 6 — Controlled launch + variant decision support
**Actions**
1. Launch grant traffic in controlled scope (limited campaigns only).
2. Monitor lead attribution by `exp_combo` and source quality.
3. Pull `/api/weekly-memo` for winner/loser signal and next action.

**Daily KPI targets**
- New attributed sessions/leads above Day 1-3 average.
- No policy violations or disapproved ads.

**Acceptance to pass Day 6**
- One winning acquisition path identified for next-week scaling.

---

### Day 7 — Run-rate decision + scale/hold plan
**Actions**
1. Consolidate 7-day KPI + channel performance.
2. Compute rolling 3-day cash/day run-rate and gap to $1,000/day.
3. Decide: keep/fix/kill for each channel and variant.
4. Publish weekly memo and next 7-day plan.

**Daily KPI targets**
- Net cash non-negative.
- Decision memo produced with explicit keep/fix/kill.

**Acceptance to pass Day 7**
- Clear, measurable next block with one primary growth lever and one risk-control lever.

## Risk controls
- Do not send deceptive claims or non-compliant ad copy.
- Keep personally identifiable lead data in approved stores only.
- Enforce auth on admin/KPI routes and never expose admin key in frontend source.
- Cap cash spend; prefer grant credit and organic outbound.

## 24h operating checklist (repeat daily)
1. 08:00 — KPI row entered.
2. 08:15 — 50-contact outbound block starts.
3. 13:00 — Follow-up + booking push.
4. 17:30 — Close loop: outbound log + KPI update + bottleneck note.
