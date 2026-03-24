const key = 'outbound_daily_logs_v1';
const form = document.getElementById('outboundForm');
const statusEl = document.getElementById('ob_status');
const progressEl = document.getElementById('ob_progress');
const barEl = document.getElementById('ob_bar');

function readLogs() {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function writeLogs(logs) {
  localStorage.setItem(key, JSON.stringify(logs));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function render() {
  const logs = readLogs();
  const today = logs.find((x) => x.date === todayISO());
  if (!today) {
    progressEl.textContent = 'Today: 0/50 contacts sent.';
    barEl.style.width = '0%';
    return;
  }
  const sent = Number(today.sent || 0);
  const replies = Number(today.replies || 0);
  const booked = Number(today.booked || 0);
  const pct = Math.min(100, Math.round((sent / 50) * 100));
  const replyRate = sent ? ((replies / sent) * 100).toFixed(1) : '0.0';
  const bookRate = sent ? ((booked / sent) * 100).toFixed(1) : '0.0';

  progressEl.textContent = `Today: ${sent}/50 sent | Replies: ${replies} (${replyRate}%) | Calls: ${booked} (${bookRate}%).`;
  barEl.style.width = `${pct}%`;
}

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const log = {
    date: document.getElementById('ob_date').value,
    sent: Number(document.getElementById('ob_sent').value || 0),
    replies: Number(document.getElementById('ob_replies').value || 0),
    booked: Number(document.getElementById('ob_booked').value || 0),
    notes: document.getElementById('ob_notes').value.trim(),
    savedAt: new Date().toISOString()
  };

  const logs = readLogs().filter((x) => x.date !== log.date);
  logs.push(log);
  logs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  writeLogs(logs);

  statusEl.textContent = `Saved outbound log for ${log.date}.`;
  render();
});

document.getElementById('ob_date').value = todayISO();
render();
