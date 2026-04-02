/**
 * Google Apps Script — Qualification Form Webhook
 * ================================================
 * Receives POST data from the Autonomous Revenue OS qualification form,
 * appends a row to a Google Sheet, and sends an email notification.
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project.
 * 2. Paste this entire file into Code.gs (replace any default code).
 * 3. Update SHEET_ID below with your Google Sheet ID
 *    (the long string in the Sheet URL between /d/ and /edit).
 * 4. Update NOTIFICATION_EMAIL if needed (default: israel@e5enclave.com).
 * 5. Click Deploy > New deployment > Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the deployment URL and paste it into script.js where indicated
 *    (replace the QUALIFICATION_WEBHOOK_URL placeholder).
 *
 * SHEET SETUP:
 * Create a Google Sheet with these column headers in row 1:
 *   Timestamp | Name | Email | Monthly Revenue | Primary Bottleneck |
 *   Desired Lift | Start in 7 Days | Fit Score | Priority |
 *   Response SLA (min) | Experiment Combo | Source | UTM Source |
 *   UTM Medium | UTM Campaign | Visitor ID
 */

// ── Configuration ──────────────────────────────────────────────────────────
var SHEET_ID = '18gJLWX9ClsxNVNRdFQNJktH4i2eaa4qmP8XzFn-CWEc'; // Zero Human Business - Qualifications
var SHEET_NAME = 'Qualifications';          // Tab name (created if missing)
var NOTIFICATION_EMAIL = 'israel@e5enclave.com';
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle GET requests (health check / CORS preflight helper)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Qualification webhook is live.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests from the qualification form
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // 1. Append row to Google Sheet
    appendToSheet(data);

    // 2. Send email notification
    sendNotification(data);

    // 3. Return success
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Qualification received.',
        priority: data.priority || 'unknown',
        fitScore: data.fitScore || 0
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Append qualification data as a new row in the Google Sheet
 */
function appendToSheet(data) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  // Create the sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Email',
      'Monthly Revenue',
      'Primary Bottleneck',
      'Desired Lift',
      'Start in 7 Days',
      'Fit Score',
      'Priority',
      'Response SLA (min)',
      'Experiment Combo',
      'Source',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Visitor ID'
    ]);
    // Bold the header row
    sheet.getRange(1, 1, 1, 16).setFontWeight('bold');
  }

  var utm = data.utm || {};
  var profile = {};

  // Parse the nested profile from `stack` field if present
  try {
    if (typeof data.stack === 'string') {
      profile = JSON.parse(data.stack);
    } else if (typeof data.stack === 'object') {
      profile = data.stack;
    }
  } catch (ignored) {}

  var row = [
    data.submittedAt || new Date().toISOString(),
    data.name || '',
    data.email || '',
    profile.monthlyRevenue || data.monthlyRevenue || '',
    profile.bottleneck || data.bottleneck || '',
    profile.desiredLift || data.desiredLift || '',
    profile.canStartIn7Days || data.canStartIn7Days || '',
    data.fitScore || profile.fitScore || '',
    data.priority || profile.priority || '',
    data.responseSlaMinutes || profile.responseSlaMinutes || '',
    (profile.experiment && profile.experiment.comboId) || data.experimentCombo || '',
    data.source || '',
    utm.utm_source || '',
    utm.utm_medium || '',
    utm.utm_campaign || '',
    utm.visitor_id || ''
  ];

  sheet.appendRow(row);
}

/**
 * Send email notification for new qualification submission
 */
function sendNotification(data) {
  var profile = {};
  try {
    if (typeof data.stack === 'string') {
      profile = JSON.parse(data.stack);
    } else if (typeof data.stack === 'object') {
      profile = data.stack;
    }
  } catch (ignored) {}

  var priority = (data.priority || profile.priority || 'unknown').toUpperCase();
  var fitScore = data.fitScore || profile.fitScore || 'N/A';
  var sla = data.responseSlaMinutes || profile.responseSlaMinutes || 'N/A';
  var revenue = profile.monthlyRevenue || data.monthlyRevenue || 'N/A';
  var lift = profile.desiredLift || data.desiredLift || 'N/A';
  var bottleneck = profile.bottleneck || data.bottleneck || 'N/A';
  var canStart = profile.canStartIn7Days || data.canStartIn7Days || 'N/A';

  var subject = '[' + priority + '] New Qualification: ' + (data.name || 'Unknown') + ' — Score ' + fitScore;

  var body = ''
    + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    + '  AUTONOMOUS REVENUE OS — QUALIFICATION\n'
    + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
    + 'Priority:       ' + priority + '\n'
    + 'Fit Score:      ' + fitScore + '/100\n'
    + 'Response SLA:   ' + sla + ' minutes\n\n'
    + '── Contact ────────────────────────────\n'
    + 'Name:           ' + (data.name || 'N/A') + '\n'
    + 'Email:          ' + (data.email || 'N/A') + '\n\n'
    + '── Qualification ──────────────────────\n'
    + 'Monthly Revenue: $' + revenue + '\n'
    + 'Desired Lift:    $' + lift + '\n'
    + 'Bottleneck:      ' + bottleneck + '\n'
    + 'Start in 7 Days: ' + canStart + '\n\n'
    + '── Experiment & Attribution ───────────\n'
    + 'Source:          ' + (data.source || 'N/A') + '\n'
    + 'Submitted:       ' + (data.submittedAt || 'N/A') + '\n\n'
    + 'View sheet: https://docs.google.com/spreadsheets/d/' + SHEET_ID + '\n';

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    body: body
  });
}
