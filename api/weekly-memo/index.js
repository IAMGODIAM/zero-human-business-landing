const { TableClient } = require('@azure/data-tables');

function json(status, body) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function sanitize(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function parseUtm(raw) {
  try {
    const obj = JSON.parse(String(raw || '{}'));
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function getMemoToken(req) {
  const q = req.query || {};
  const h = req.headers || {};
  return String(q.token || h['x-memo-token'] || '').trim();
}

async function listLeadEntities() {
  const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
  const tableName = process.env.LEADS_TABLE_NAME || 'inboundleads';
  if (!conn) throw new Error('LEADS_TABLE_CONNECTION_STRING not configured');

  const client = TableClient.fromConnectionString(conn, tableName);
  const rows = [];
  for await (const e of client.listEntities()) {
    rows.push(e);
    if (rows.length >= 5000) break;
  }
  return rows;
}

async function listKpiRows() {
  const conn = process.env.LEADS_TABLE_CONNECTION_STRING;
  const tableName = process.env.KPI_TABLE_NAME || 'dailykpi';
  if (!conn) return [];

  const client = TableClient.fromConnectionString(conn, tableName);
  const rows = [];
  for await (const e of client.listEntities()) {
    rows.push(e);
    if (rows.length >= 1000) break;
  }
  return rows;
}

function summarizeVariantPerformance(leadEntities, minDate) {
  const stats = new Map();

  for (const e of leadEntities) {
    const date = String(e.partitionKey || '');
    if (!date || date < minDate) continue;

    const source = String(e.source || '');
    if (!source.includes('strategy-call-qualification') && !source.includes('zero-human-business-landing')) continue;

    const utm = parseUtm(e.utm);
    const combo = sanitize(utm.exp_combo || (source.split('|')[1] || 'unknown'), 40).toLowerCase();
    if (!combo || combo === 'unknown') continue;

    const row = stats.get(combo) || {
      combo,
      headline: sanitize(utm.exp_headline || '', 12),
      offer: sanitize(utm.exp_offer || '', 12),
      qualificationLeads: 0,
      buildRequestLeads: 0,
      totalLeads: 0,
      score: 0
    };

    const isQualification = source.includes('strategy-call-qualification');
    if (isQualification) row.qualificationLeads += 1;
    else row.buildRequestLeads += 1;

    row.totalLeads += 1;
    row.score = row.qualificationLeads * 2 + row.buildRequestLeads;
    stats.set(combo, row);
  }

  const rows = [...stats.values()].sort((a, b) => b.score - a.score || b.totalLeads - a.totalLeads);
  return rows;
}

function summarizeKpi(kpiRows, minDate) {
  const byDate = new Map();
  for (const e of kpiRows) {
    const date = String(e.date || e.partitionKey || '');
    if (!date || date < minDate) continue;
    const existing = byDate.get(date);
    const savedAt = String(e.savedAt || '');
    if (!existing || savedAt > existing.savedAt) {
      byDate.set(date, {
        date,
        cash: Number(e.cash || 0),
        callsBooked: Number(e.callsBooked || 0),
        callsHeld: Number(e.callsHeld || 0),
        dealsClosed: Number(e.dealsClosed || 0),
        spend: Number(e.spend || 0),
        savedAt
      });
    }
  }

  const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const totals = rows.reduce((acc, r) => {
    acc.cash += r.cash;
    acc.callsBooked += r.callsBooked;
    acc.callsHeld += r.callsHeld;
    acc.dealsClosed += r.dealsClosed;
    acc.spend += r.spend;
    return acc;
  }, { cash: 0, callsBooked: 0, callsHeld: 0, dealsClosed: 0, spend: 0 });

  const days = Math.max(1, rows.length);
  return {
    days: rows.length,
    avgCashPerDay: totals.cash / days,
    netCash: totals.cash - totals.spend,
    closeRateHeld: totals.callsHeld ? (totals.dealsClosed / totals.callsHeld) * 100 : 0,
    totals
  };
}

function buildMemo(variantRows, kpi) {
  if (!variantRows.length) {
    return {
      winner: null,
      loser: null,
      memoText: `Weekly Decision Memo\n- No experiment-attributed leads yet.\n- KPI: avg cash/day $${Math.round(kpi.avgCashPerDay)} | net cash $${Math.round(kpi.netCash)}.\n- Recommendation: run traffic intentionally to at least 30 attributed sessions and 10 leads before deciding winner/loser.`
    };
  }

  const winner = variantRows[0];
  const loser = variantRows.length > 1 ? variantRows[variantRows.length - 1] : null;

  const lines = [
    'Weekly Decision Memo',
    `- Winner: ${winner.combo} (score ${winner.score}, qualified ${winner.qualificationLeads}, build ${winner.buildRequestLeads})`,
    loser ? `- Loser: ${loser.combo} (score ${loser.score}, qualified ${loser.qualificationLeads}, build ${loser.buildRequestLeads})` : '- Loser: insufficient comparison data',
    `- KPI: avg cash/day $${Math.round(kpi.avgCashPerDay)} | net cash $${Math.round(kpi.netCash)} | close rate (held) ${kpi.closeRateHeld.toFixed(1)}%`,
    `- Recommendation: keep ${winner.combo}, cut ${loser ? loser.combo : 'none yet'}, test next challenger against winner with one-variable change.`
  ];

  return { winner, loser, memoText: lines.join('\n') };
}

module.exports = async function (context, req) {
  try {
    const expected = String(process.env.WEEKLY_MEMO_TOKEN || '').trim();
    if (expected) {
      const provided = getMemoToken(req);
      if (!provided || provided !== expected) {
        return json(401, { ok: false, error: 'unauthorized' });
      }
    }

    const minDate = daysAgoIso(7);
    const [leadEntities, kpiRows] = await Promise.all([listLeadEntities(), listKpiRows()]);
    const variantRows = summarizeVariantPerformance(leadEntities, minDate);
    const kpi = summarizeKpi(kpiRows, minDate);
    const memo = buildMemo(variantRows, kpi);

    return json(200, {
      ok: true,
      window: { minDate, maxDate: new Date().toISOString().slice(0, 10) },
      winner: memo.winner,
      loser: memo.loser,
      kpi,
      variants: variantRows,
      memo: memo.memoText
    });
  } catch (error) {
    context.log.error('weekly memo error', error);
    return json(500, { ok: false, error: error.message || 'internal_error' });
  }
};
