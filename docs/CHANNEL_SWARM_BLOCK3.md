Channel Swarm Block 3 (Revenue Target: $1,000/day)

Objective
- Run a coordinated multi-channel demand engine that compounds qualified bookings and cash/day.
- Keep one core offer spine while adapting message wrappers by channel.

Core thesis
- Do not scale channels before signal.
- One winner landing combo at a time (from /api/weekly-memo).
- One challenger test per week against winner.

Active channels (initial)
1) LinkedIn (primary authority + outbound)
2) Email outbound (paired touches)
3) X/Twitter (distribution + proof loops)
4) Referral/partner DM lane (warm intros)

Optional channels after baseline
- YouTube shorts / reels
- Retargeting ads
- Communities/newsletters sponsorships

Attribution protocol
- Every outbound link uses UTM + variant params:
  - utm_source, utm_medium, utm_campaign, utm_content
  - h=<1..5> and o=<1..2> when forcing specific variant in experiments
- Lead payloads already preserve:
  - exp_version, exp_headline, exp_offer, exp_combo, visitor_id

Canonical campaign naming
- utm_campaign format: b3_<week>_<channel>_<angle>
- examples:
  - b3_w1_linkedin_cash-leak
  - b3_w1_email_followup-gap
  - b3_w1_x_founder-control

Daily operating sequence (America/New_York)
- 08:00 KPI update (/kpi.html)
- 08:15 Outbound lane: 50 targeted contacts (/outbound.html)
- 09:30 LinkedIn post + 10 targeted comments
- 13:00 Reply + booking push
- 17:30 Close loop: outbound log + KPI + notes

Weekly operating sequence
- Monday: read /api/weekly-memo winner/loser output
- Tuesday: launch one challenger against winner
- Wednesday–Friday: hold variables steady, optimize follow-up only
- Friday: decision memo + next week challenger

Delegation map (integrator lanes)
- Growth Integrator
  - controls tests, variant rotation, landing optimization
- Outbound Integrator
  - executes daily 50 target list + first touch + follow-up
- Content Integrator
  - LinkedIn/X artifacts aligned to winner angle
- Analytics Integrator
  - attribution QA, KPI hygiene, confidence checks
- Close Integrator
  - qualification script, objections, offer refinement

Escalation gates
Escalate to Hermie if:
- channel CAC trend worsens for 2 consecutive weeks
- close rate drops below 20% held-call baseline
- message requires major brand/positioning shift
- paid media budget > $100/day is requested

Metrics stack
Primary:
- cash/day
- qualified bookings/day
- close rate on held calls
Secondary:
- reply rate by channel
- booked-call rate by channel
- cost per booked call

Hard thresholds
- outbound sent/day < 50 => red
- LinkedIn engagement quality < 3 qualified conversations/week => revise angle
- booked-call rate < 1.5% for 7 days => targeting and CTA rewrite
- close rate held < 20% => qualification and close script intervention

Execution constraints
- no channel expansion without attribution discipline
- no more than one net-new major variable/week
- do not break security and governance controls

Outputs required weekly
- winner/loser memo
- channel scorecard
- next challenger brief
- escalation list (if any)
