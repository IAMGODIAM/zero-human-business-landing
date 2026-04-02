#!/usr/bin/env python3
"""
Outreach Engine — Sends personalized cold emails via Microsoft Graph API.
Uses hermes@e5enclave.com as sender.
Tracks sent/replied status in a local JSON log.

Usage:
    python3 outreach_engine.py preview          # Preview first batch
    python3 outreach_engine.py send --batch 15  # Send to first N unsent prospects
    python3 outreach_engine.py status           # Show send log
    python3 outreach_engine.py send-followup --day 3   # Send Day 3 follow-up to eligible
    python3 outreach_engine.py send-followup --day 7   # Send Day 7 breakup to eligible
"""

import argparse
import csv
import json
import os
import sys
import subprocess
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_DIR = SCRIPT_DIR.parent
PROSPECTS_CSV = PROJECT_DIR / "prospects" / "target-list.csv"
SEND_LOG = PROJECT_DIR / "scripts" / "outreach_log.json"
GRAPH_EMAIL = Path.home() / ".hermes" / "email" / "graph_email.py"

# Config
SENDER = "hermes@e5enclave.com"
LANDING_URL = "https://agentbusinessos.com/#qualify"
SIGNATURE = "— Israel Lee\nE5 Enclave | Agent Business OS\nhttps://agentbusinessos.com"
UNSUBSCRIBE = "\n\n---\nE5 Enclave LLC | Austin, TX\nReply STOP to opt out."

# ─── Email Templates ───────────────────────────────────────────────────────

def email_day0(first_name, company, bottleneck):
    subject = f"{first_name}, who's running {company} while you sleep?"
    body = f"""{first_name},

Quick question — how much of your week at {company} is spent on {bottleneck} instead of closing deals or building the thing that actually grows revenue?

Most founders I talk to in the $50k–$500k/month range are buried in the same trap: they ARE the system. Every decision, every escalation, every follow-up routes back to them.

We built the Agent Business OS to kill that loop.

It's an AI agent layer that handles capture, decision, conversion, and fulfillment — deployed in 30 days. You get first signal in 48–96 hours. Not a dashboard. Not another SaaS login. An operating system that runs your revenue engine with exception-only founder escalation.

Worth a 10-minute look?

→ {LANDING_URL}

{SIGNATURE}{UNSUBSCRIBE}"""
    return subject, body


def email_day3(first_name, company, bottleneck):
    subject = "+32% bookings, zero new hires (how)"
    body = f"""{first_name},

Circling back with a number: founders running the Agent Business OS are seeing an 18–42% lift in qualified booking rate by week 3.

No new headcount. No 6-month integration. No "let's align on the roadmap" nonsense.

Here's what actually happens:
• 48–96h: First autonomous signal live
• Week 1: Capture + decision layers operational
• Week 3: Conversion and fulfillment running — you're only pulled in for exceptions

The setup starts at $2,500. The ROI math on replacing even one bottleneck like {bottleneck} at {company} isn't close.

Human override is always retained. You stay in control — you just stop being the bottleneck.

10 minutes. That's all I need to show you the architecture.

→ {LANDING_URL}

{SIGNATURE}{UNSUBSCRIBE}"""
    return subject, body


def email_day7(first_name, company, bottleneck):
    subject = f"closing your file, {first_name}"
    body = f"""{first_name},

I'll keep this short. I've reached out twice — no response, which tells me one of three things:

1. The timing is wrong (fair).
2. {bottleneck} isn't the real pain point at {company} right now.
3. You've already solved this (if so, genuinely curious how).

Either way, I'm not going to keep emailing.

But before I go — we published our internal framework for mapping which revenue operations to hand to AI agents vs. keep human. No gate, no opt-in. Genuinely useful if you're thinking about this at all:

→ {LANDING_URL}

If the timing lines up later, you know where to find us.

No hard feelings.

{SIGNATURE}{UNSUBSCRIBE}"""
    return subject, body


# ─── Utilities ──────────────────────────────────────────────────────────────

def load_prospects():
    """Load prospects from CSV."""
    prospects = []
    with open(PROSPECTS_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Extract first name from founder_name
            founder = row.get('founder_name', '').strip()
            first_name = founder.split()[0] if founder else 'there'
            
            # Extract a short, conversational bottleneck phrase
            bottleneck_raw = row.get('bottleneck_hypothesis', '')
            # Take the first clause (before semicolon)
            bottleneck = bottleneck_raw.split(';')[0].strip().lower()
            # Map verbose descriptions to tight phrases
            bottleneck_map = {
                'manual ticket triage': 'manual ticket triage and onboarding',
                'growing client base': 'slow lead response',
                'complex sales cycle': 'complex multi-stakeholder sales cycles',
                'regional msp struggling': 'referral-dependent lead gen',
                'high inbound volume but conversion': 'manual demo scheduling',
                'high-volume inbound from content': 'manual lead qualification',
                'massive lead volume but sales': 'lead follow-up bottlenecks',
                'growing agency but founder': 'founder-dependent sales',
                'complex b2b sales cycle': 'manual lead scoring and routing',
                'strong brand but sales': 'founder-dependent pipeline',
                'rapid growth creating': 'fulfillment bottlenecks',
                'high volume of small-ticket': 'manual sales touchpoints',
                'founder-dependent sales': 'founder-dependent sales',
                'manual candidate sourcing': 'manual sourcing and intake',
                'high volume of client requests': 'admin-heavy recruiting workflows',
                'manual outreach to both': 'manual outreach and poor pipeline visibility',
                'founder-led sales with': 'referral-dependent pipeline',
                'complex multi-service': 'manual lead routing across divisions',
                'manual client intake': 'slow time-to-fill',
                'agents drowning in': 'manual quote and follow-up processes',
                'complex commercial policies': 'slow prospect follow-up',
                'rapid m&a growth': 'inconsistent sales processes',
                'franchise owners struggling': 'inconsistent lead follow-up across franchises',
                'growing through acquisition': 'lead leakage during integrations',
                'agents spending hours': 'manual lead qualification',
                'massive agent network': 'slow lead response times',
                'tech-forward brand': 'manual lead qualification',
                'cost-efficient model': 'limited sales support for agents',
                'white-label platform': 'manual lead handoff',
                'high call volume but manual': 'manual scheduling and dispatch',
                'multiple home service brands': 'missed leads from slow response',
                'high ad spend driving leads': 'manual appointment setting',
                'massive franchise network': 'inconsistent lead follow-up',
                'event booking process': 'manual booking and group sales',
                'manual quote process': 'slow quoting and scheduling',
                'seasonal demand spikes': 'seasonal demand overwhelming scheduling',
                'high-ticket consulting': 'founder-dependent pipeline',
                'fractional cmo model': 'zero bandwidth for business development',
                'membership model needs': 'manual member nurture and onboarding',
                'high demand but bottlenecked': 'consultant bandwidth constraints',
                'classic founder-led sales': 'inconsistent month-to-month pipeline',
                'network of fractional cfos': 'referral-dependent lead gen',
                'manual matching process': 'slow follow-up on inquiries',
                'large fractional executive': 'slow prospect response times',
                'founder doing all sales': 'zero time for prospecting',
                'small team with big': 'manual everything in sales',
                'complex service packages': 'time-intensive lead qualification',
                'high volume of price-sensitive': 'manual lead qualification',
                'multiple business lines': 'lead routing confusion',
                'high churn in va': 'manual matching and late renewals',
                'global team but sales': 'founder-dependent sales and slow proposals',
                'practice what they preach': 'manual internal sales process',
            }
            matched = False
            for key, val in bottleneck_map.items():
                if key in bottleneck:
                    bottleneck = val
                    matched = True
                    break
            if not matched and len(bottleneck) > 60:
                # Fallback: take first meaningful phrase
                bottleneck = bottleneck[:57].rsplit(' ', 1)[0]
            
            prospects.append({
                'company': row.get('company_name', '').strip(),
                'founder_name': founder,
                'first_name': first_name,
                'email': row.get('email (best guess format)', '').strip(),
                'linkedin': row.get('linkedin_url', '').strip(),
                'website': row.get('website', '').strip(),
                'revenue': row.get('estimated_revenue_range', '').strip(),
                'service': row.get('primary_service', '').strip(),
                'bottleneck': bottleneck,
                'outreach_angle': row.get('outreach_angle', '').strip(),
            })
    return prospects


def load_send_log():
    """Load or initialize send log."""
    if SEND_LOG.exists():
        with open(SEND_LOG, 'r') as f:
            return json.load(f)
    return {}


def save_send_log(log):
    """Save send log."""
    with open(SEND_LOG, 'w') as f:
        json.dump(log, f, indent=2, default=str)


def send_email(to, subject, body):
    """Send email via Graph API."""
    result = subprocess.run(
        [sys.executable, str(GRAPH_EMAIL), 'send',
         '--to', to,
         '--subject', subject,
         '--body', body],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise Exception(f"Send failed: {result.stderr}")
    return result.stdout.strip()


# ─── Commands ───────────────────────────────────────────────────────────────

def cmd_preview(args):
    """Preview emails for first batch."""
    prospects = load_prospects()
    log = load_send_log()
    
    unsent = [p for p in prospects if p['email'] not in log]
    batch = unsent[:args.batch]
    
    print(f"=== PREVIEW: {len(batch)} emails (Day 0) ===\n")
    for i, p in enumerate(batch, 1):
        subject, body = email_day0(p['first_name'], p['company'], p['bottleneck'])
        print(f"--- [{i}] {p['founder_name']} <{p['email']}> ---")
        print(f"Subject: {subject}")
        print(f"Bottleneck: {p['bottleneck']}")
        print(f"Body preview: {body[:200]}...")
        print()


def cmd_send(args):
    """Send Day 0 emails to batch."""
    prospects = load_prospects()
    log = load_send_log()
    
    unsent = [p for p in prospects if p['email'] not in log]
    batch = unsent[:args.batch]
    
    if not batch:
        print("No unsent prospects remaining.")
        return
    
    print(f"=== SENDING: {len(batch)} Day 0 emails ===\n")
    sent_count = 0
    
    for i, p in enumerate(batch, 1):
        subject, body = email_day0(p['first_name'], p['company'], p['bottleneck'])
        try:
            result = send_email(p['email'], subject, body)
            log[p['email']] = {
                'founder': p['founder_name'],
                'company': p['company'],
                'day0_sent': datetime.now().isoformat(),
                'day0_subject': subject,
                'day3_sent': None,
                'day7_sent': None,
                'replied': False,
                'opted_out': False,
            }
            sent_count += 1
            print(f"  [{i}/{len(batch)}] ✓ {p['founder_name']} <{p['email']}> — {result}")
        except Exception as e:
            print(f"  [{i}/{len(batch)}] ✗ {p['founder_name']} <{p['email']}> — ERROR: {e}")
    
    save_send_log(log)
    print(f"\n=== DONE: {sent_count}/{len(batch)} sent ===")
    print(f"Log saved: {SEND_LOG}")


def cmd_send_followup(args):
    """Send Day 3 or Day 7 follow-ups to eligible prospects."""
    log = load_send_log()
    day = args.day
    now = datetime.now()
    
    eligible = []
    for email, entry in log.items():
        if entry.get('replied') or entry.get('opted_out'):
            continue
        
        if day == 3 and entry.get('day3_sent') is None and entry.get('day0_sent'):
            sent_at = datetime.fromisoformat(entry['day0_sent'])
            if (now - sent_at) >= timedelta(days=3):
                eligible.append((email, entry))
        
        elif day == 7 and entry.get('day7_sent') is None and entry.get('day3_sent'):
            sent_at = datetime.fromisoformat(entry['day3_sent'])
            if (now - sent_at) >= timedelta(days=4):
                eligible.append((email, entry))
    
    if not eligible:
        print(f"No prospects eligible for Day {day} follow-up yet.")
        return
    
    prospects = {p['email']: p for p in load_prospects()}
    template_fn = email_day3 if day == 3 else email_day7
    day_key = f'day{day}_sent'
    
    print(f"=== SENDING: {len(eligible)} Day {day} follow-ups ===\n")
    sent_count = 0
    
    for i, (email, entry) in enumerate(eligible, 1):
        p = prospects.get(email, {})
        first_name = p.get('first_name', entry.get('founder', '').split()[0])
        company = p.get('company', entry.get('company', ''))
        bottleneck = p.get('bottleneck', 'operational bottleneck')
        
        subject, body = template_fn(first_name, company, bottleneck)
        try:
            result = send_email(email, subject, body)
            entry[day_key] = datetime.now().isoformat()
            sent_count += 1
            print(f"  [{i}/{len(eligible)}] ✓ {entry['founder']} <{email}> — {result}")
        except Exception as e:
            print(f"  [{i}/{len(eligible)}] ✗ {entry['founder']} <{email}> — ERROR: {e}")
    
    save_send_log(log)
    print(f"\n=== DONE: {sent_count}/{len(eligible)} sent ===")


def cmd_status(args):
    """Show send log status."""
    log = load_send_log()
    prospects = load_prospects()
    
    total = len(prospects)
    contacted = len(log)
    day3_sent = sum(1 for e in log.values() if e.get('day3_sent'))
    day7_sent = sum(1 for e in log.values() if e.get('day7_sent'))
    replied = sum(1 for e in log.values() if e.get('replied'))
    opted_out = sum(1 for e in log.values() if e.get('opted_out'))
    
    print(f"=== OUTREACH STATUS ===")
    print(f"  Total prospects:   {total}")
    print(f"  Day 0 sent:        {contacted}")
    print(f"  Day 3 sent:        {day3_sent}")
    print(f"  Day 7 sent:        {day7_sent}")
    print(f"  Replied:           {replied}")
    print(f"  Opted out:         {opted_out}")
    print(f"  Remaining unsent:  {total - contacted}")
    
    if contacted:
        print(f"\n  --- Recent sends ---")
        for email, entry in sorted(log.items(), key=lambda x: x[1].get('day0_sent', ''), reverse=True)[:10]:
            status_flags = []
            if entry.get('day0_sent'): status_flags.append("D0")
            if entry.get('day3_sent'): status_flags.append("D3")
            if entry.get('day7_sent'): status_flags.append("D7")
            if entry.get('replied'): status_flags.append("REPLIED")
            if entry.get('opted_out'): status_flags.append("STOP")
            print(f"    {entry['founder']:<25} {email:<40} [{', '.join(status_flags)}]")


# ─── Main ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Outreach Engine')
    sub = parser.add_subparsers(dest='command')
    
    p_preview = sub.add_parser('preview', help='Preview first batch')
    p_preview.add_argument('--batch', type=int, default=15)
    
    p_send = sub.add_parser('send', help='Send Day 0 emails')
    p_send.add_argument('--batch', type=int, default=15)
    
    p_followup = sub.add_parser('send-followup', help='Send follow-up emails')
    p_followup.add_argument('--day', type=int, required=True, choices=[3, 7])
    
    p_status = sub.add_parser('status', help='Show send log')
    
    args = parser.parse_args()
    
    if args.command == 'preview':
        cmd_preview(args)
    elif args.command == 'send':
        cmd_send(args)
    elif args.command == 'send-followup':
        cmd_send_followup(args)
    elif args.command == 'status':
        cmd_status(args)
    else:
        parser.print_help()
