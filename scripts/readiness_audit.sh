#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-zero-human-landing}"
RESOURCE_GROUP="${2:-nerve-center-rg}"
REPO="${3:-IAMGODIAM/zero-human-business-landing}"

echo "== Zero Human Business Readiness Audit =="
echo "app=$APP_NAME rg=$RESOURCE_GROUP repo=$REPO"
echo

echo "[1/6] Azure account"
az account show --query "{name:name,tenantId:tenantId,subscriptionId:id}" -o table

echo
echo "[2/6] Static Web App status"
az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "{defaultHostname:defaultHostname,branch:branch,provider:provider,sku:sku.name,repositoryUrl:repositoryUrl}" -o table

echo
echo "[3/6] App settings presence (masked)"
APP_SETTINGS_JSON=$(az staticwebapp appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o json)
export APP_SETTINGS_JSON
python3 - <<'PY'
import json, os
required = [
    "LEADS_TABLE_CONNECTION_STRING",
    "LEADS_TABLE_NAME",
    "ADMIN_DASHBOARD_KEY",
    "LEAD_SIGNATURE_MODE",
    "LEAD_SIGNATURE_SECRET",
    "LEAD_SIGNATURE_TOLERANCE_SEC",
    "WEEKLY_MEMO_TOKEN",
]
optional = [
    "KPI_TABLE_NAME",
    "LEAD_WEBHOOK_URL",
    "LEAD_WEBHOOK_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_THREAD_ID",
    "WRITING_OPENAI_URL",
    "WRITING_OPENAI_TOKEN",
    "WRITING_OPENAI_DEPLOYMENT",
    "WRITING_OPENAI_API_VERSION",
]
j = json.loads(os.environ["APP_SETTINGS_JSON"]) 
props = j.get("properties", {})

def state(k):
    return "set" if str(props.get(k, "")).strip() else "missing"

print("Required:")
for k in required:
    print(f"  - {k}: {state(k)}")
print("Optional:")
for k in optional:
    print(f"  - {k}: {state(k)}")
PY

echo
echo "[4/6] API endpoint smoke test (HTTP code only)"
HOST=$(az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostname -o tsv)
code_root=$(curl -sS -o /dev/null -w "%{http_code}" "https://$HOST/" || true)
code_lead_post=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "https://$HOST/api/lead" -H 'content-type: application/json' -d '{}' || true)
code_kpi=$(curl -sS -o /dev/null -w "%{http_code}" "https://$HOST/api/kpi" || true)
code_leads=$(curl -sS -o /dev/null -w "%{http_code}" "https://$HOST/api/leads" || true)
code_memo=$(curl -sS -o /dev/null -w "%{http_code}" "https://$HOST/api/weekly-memo" || true)
printf "  - / => %s\n" "$code_root"
printf "  - POST /api/lead (empty payload expected 400) => %s\n" "$code_lead_post"
printf "  - /api/kpi => %s\n" "$code_kpi"
printf "  - /api/leads => %s\n" "$code_leads"
printf "  - /api/weekly-memo => %s\n" "$code_memo"

echo
echo "[5/6] Latest GitHub deploy workflow runs"
gh run list -R "$REPO" --limit 5 --json workflowName,status,conclusion,createdAt,headSha,url \
  --jq '.[] | "  - \(.workflowName) | \(.status)/\(.conclusion) | \(.createdAt) | \(.headSha[0:7]) | \(.url)"'

echo
echo "[6/6] Azure Table integrity sample counts"
CONN=$(az staticwebapp appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.LEADS_TABLE_CONNECTION_STRING' -o tsv)
LEADS_TABLE=$(az staticwebapp appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.LEADS_TABLE_NAME' -o tsv)
KPI_TABLE=$(az staticwebapp appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query 'properties.KPI_TABLE_NAME' -o tsv)
if [[ -z "$KPI_TABLE" ]]; then KPI_TABLE="dailykpi"; fi
export CONN LEADS_TABLE KPI_TABLE

pushd api >/dev/null
npm install --silent >/dev/null 2>&1 || true
node <<'NODE'
const { TableClient } = require('@azure/data-tables');
const conn = process.env.CONN;
const leadsTable = process.env.LEADS_TABLE || 'inboundleads';
const kpiTable = process.env.KPI_TABLE || 'dailykpi';

async function count(tableName, tsKeys = ['receivedAt', 'savedAt', 'submittedAt']) {
  const client = TableClient.fromConnectionString(conn, tableName);
  let count = 0;
  let latest = null;
  const entities = [];
  try {
    for await (const e of client.listEntities()) {
      count += 1;
      entities.push(e);
      const candidate = tsKeys.map((k) => e[k]).find(Boolean);
      if (candidate && (!latest || String(candidate) > String(latest))) latest = candidate;
      if (count >= 20000) break;
    }
  } catch (err) {
    if (String(err.message || err).includes('TableNotFound')) {
      return { table: tableName, count: 0, latest: null, missing: true, entities: [] };
    }
    throw err;
  }
  return { table: tableName, count, latest, missing: false, entities };
}

function summarizeLifecycle(leads) {
  const stage = {};
  const status = {};
  const outreach = {};
  const emailCounts = {};

  for (const e of leads) {
    const stageKey = String(e.stage || '(blank)').trim() || '(blank)';
    const statusKey = String(e.status || '(blank)').trim() || '(blank)';
    const outreachKey = String(e.outreachStatus || '(blank)').trim() || '(blank)';
    stage[stageKey] = (stage[stageKey] || 0) + 1;
    status[statusKey] = (status[statusKey] || 0) + 1;
    outreach[outreachKey] = (outreach[outreachKey] || 0) + 1;

    const email = String(e.email || '').toLowerCase().trim();
    if (email) emailCounts[email] = (emailCounts[email] || 0) + 1;
  }

  const duplicateEmails = Object.entries(emailCounts).filter(([, n]) => n > 1).length;
  return { stage, status, outreach, duplicateEmails };
}

(async () => {
  const leads = await count(leadsTable);
  const kpi = await count(kpiTable, ['savedAt']);
  console.log(`  - ${leads.table}: count=${leads.count} latest=${leads.latest || 'n/a'} missing=${leads.missing}`);
  if (!leads.missing) {
    const lifecycle = summarizeLifecycle(leads.entities || []);
    console.log(`    lifecycle.stage=${JSON.stringify(lifecycle.stage)}`);
    console.log(`    lifecycle.status=${JSON.stringify(lifecycle.status)}`);
    console.log(`    lifecycle.outreach=${JSON.stringify(lifecycle.outreach)}`);
    console.log(`    duplicate_emails=${lifecycle.duplicateEmails}`);
  }
  console.log(`  - ${kpi.table}: count=${kpi.count} latest=${kpi.latest || 'n/a'} missing=${kpi.missing}`);
})();
NODE
popd >/dev/null

echo
echo "Audit complete."
