#!/usr/bin/env node
let TableClient;
try {
  ({ TableClient } = require('@azure/data-tables'));
} catch {
  ({ TableClient } = require('../api/node_modules/@azure/data-tables'));
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const shouldApply = process.argv.includes('--apply');
const conn = process.env.LEADS_TABLE_CONNECTION_STRING || process.env.CONN;
const tableName = process.env.LEADS_TABLE_NAME || process.env.LEADS_TABLE || 'inboundleads';
const dryRunLimit = Number(getArg('--limit') || 0);

if (!conn) {
  console.error('Missing LEADS_TABLE_CONNECTION_STRING (or CONN)');
  process.exit(1);
}

function normalize(v) {
  return String(v || '').trim();
}

async function main() {
  const client = TableClient.fromConnectionString(conn, tableName);

  const emailCounts = new Map();
  let total = 0;
  let missingEmail = 0;
  let missingName = 0;
  let missingLifecycleAny = 0;
  let lifecycleMissingRows = 0;
  let patched = 0;

  for await (const e of client.listEntities()) {
    total += 1;
    const email = normalize(e.email).toLowerCase();
    const name = normalize(e.name);
    if (!email) missingEmail += 1;
    else emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    if (!name) missingName += 1;

    const stage = normalize(e.stage);
    const status = normalize(e.status);
    const outreachStatus = normalize(e.outreachStatus);
    const lifecycleMissing = !stage || !status || !outreachStatus;
    if (lifecycleMissing) {
      missingLifecycleAny += 1;
      lifecycleMissingRows += 1;

      if (shouldApply) {
        await client.updateEntity({
          partitionKey: e.partitionKey,
          rowKey: e.rowKey,
          stage: stage || 'new',
          status: status || 'open',
          outreachStatus: outreachStatus || 'pending',
          lifecycleUpdatedAt: new Date().toISOString()
        }, 'Merge');
        patched += 1;
      }
    }

    if (dryRunLimit > 0 && total >= dryRunLimit) break;
  }

  const duplicateEmails = [...emailCounts.values()].filter((n) => n > 1).length;

  const result = {
    ok: true,
    table: tableName,
    mode: shouldApply ? 'apply' : 'dry-run',
    total,
    duplicateEmails,
    recordsMissingEmail: missingEmail,
    recordsMissingName: missingName,
    recordsMissingAnyLifecycle: missingLifecycleAny,
    lifecycleRowsScannedMissing: lifecycleMissingRows,
    lifecycleRowsPatched: patched,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2));
  process.exit(1);
});
