Growth Block Operations (Target: $1,000/day)

Objective
- Build and operate a daily execution loop that increases booked calls, close rate, and cash/day.

Primary metrics
- Cash/day
- Calls booked/day
- Calls held/day
- Close rate (deals closed / calls held)
- Net cash/day (cash - spend)

System components
- Public funnel: /
- Qualification form: #qualify section on homepage
- Lead intake backend: POST /api/lead
- Outbound discipline board: /outbound.html (authenticated)
- KPI board: /kpi.html + /api/kpi (authenticated + x-admin-key)
- Lead dashboard: /admin.html + /api/leads

Daily operating cadence (NYC timezone)
1) 8:00 AM - KPI update
   - Enter yesterday/today KPI row in /kpi.html
2) 8:15 AM - Outbound block
   - Execute 50 targeted contacts in /outbound.html tracker
3) 1:00 PM - Follow-up block
   - Reply handling and booking push
4) 5:30 PM - Close loop
   - Update outbound log and KPI board
   - Record script variant and bottleneck notes

Weekly review
- Keep: scripts with strongest booked-call rate
- Kill: scripts below threshold for 2 consecutive weeks
- Test one variable at a time (headline, CTA, opener, offer framing)

RL-style loop
- State: traffic, lead quality, booked calls, close rate, cash/day
- Action: one bounded change each iteration
- Reward: net cash/day and qualified bookings
- Constraint: do not break mission, brand, or legal posture

Hard thresholds (suggested)
- Outbound sent/day < 50 => red
- Reply rate < 3% => rewrite opening line
- Booked-call rate < 1.5% => refine CTA + targeting
- Close rate (held) < 20% => update qualification + call script

Notes
- Keep experiments bounded and reversible.
- Measure before changing multiple variables.
- Prioritize durable cashflow over vanity traffic.
