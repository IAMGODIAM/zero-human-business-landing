"""
Qualification Form Webhook — Azure Container App
Receives POST from landing page form, appends to Google Sheet, sends email.
Deployed as a lightweight FastAPI app.
"""
import os
import json
import logging
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import smtplib
from email.mime.text import MIMEText

app = FastAPI(title="Qual Webhook")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
SHEET_ID = "18gJLWX9ClsxNVNRdFQNJktH4i2eaa4qmP8XzFn-CWEc"
SHEET_NAME = "Qualifications"
NOTIFICATION_EMAIL = "israel@e5enclave.com"
GOOGLE_TOKEN_PATH = os.environ.get("GOOGLE_TOKEN_PATH", "/app/google_token.json")

# CORS - allow the landing page
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://iamgodiam.github.io",
        "http://localhost:*",
        "http://127.0.0.1:*",
    ],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


def get_sheets_service():
    """Get authenticated Google Sheets service."""
    creds = Credentials.from_authorized_user_file(GOOGLE_TOKEN_PATH)
    return build("sheets", "v4", credentials=creds)


def append_to_sheet(data: dict):
    """Append qualification data to Google Sheet."""
    service = get_sheets_service()
    
    profile = {}
    if "stack" in data:
        try:
            profile = json.loads(data["stack"]) if isinstance(data["stack"], str) else data["stack"]
        except (json.JSONDecodeError, TypeError):
            pass
    
    utm = data.get("utm", {})
    row = [
        data.get("submittedAt", datetime.utcnow().isoformat()),
        data.get("name", ""),
        data.get("email", ""),
        profile.get("monthlyRevenue", data.get("monthlyRevenue", "")),
        profile.get("bottleneck", data.get("bottleneck", "")),
        profile.get("desiredLift", data.get("desiredLift", "")),
        profile.get("canStartIn7Days", data.get("canStartIn7Days", "")),
        data.get("source", ""),
        data.get("priority", profile.get("priority", "")),
        "New",
    ]
    
    service.spreadsheets().values().append(
        spreadsheetId=SHEET_ID,
        range=f"{SHEET_NAME}!A:J",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()
    
    logger.info(f"Appended row for {data.get('name', 'unknown')} to sheet")


def send_notification(data: dict):
    """Send email notification via Graph API or SMTP."""
    priority = data.get("priority", "unknown").upper()
    fit_score = data.get("fitScore", "N/A")
    name = data.get("name", "Unknown")
    email = data.get("email", "N/A")
    revenue = data.get("monthlyRevenue", "N/A")
    bottleneck = data.get("bottleneck", "N/A")
    lift = data.get("desiredLift", "N/A")
    can_start = data.get("canStartIn7Days", "N/A")
    
    subject = f"[{priority}] New Qualification: {name} — Score {fit_score}"
    body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUTONOMOUS REVENUE OS — QUALIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority:       {priority}
Fit Score:      {fit_score}/100

── Contact ────────────────────────────
Name:           {name}
Email:          {email}

── Qualification ──────────────────────
Monthly Revenue: ${revenue}
Desired Lift:    ${lift}
Bottleneck:      {bottleneck}
Start in 7 Days: {can_start}

── Action ─────────────────────────────
View sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}
Submitted:  {data.get('submittedAt', 'N/A')}
"""
    
    # Try Graph API email
    try:
        from graph_email import send_email
        send_email(to=NOTIFICATION_EMAIL, subject=subject, body=body)
        logger.info(f"Email sent via Graph API to {NOTIFICATION_EMAIL}")
    except Exception as e:
        logger.warning(f"Graph email failed: {e}, skipping email notification")


@app.get("/")
async def health():
    return {"status": "ok", "service": "qual-webhook"}


@app.post("/api/qualify")
async def qualify(request: Request):
    """Receive qualification form submission."""
    try:
        data = await request.json()
        logger.info(f"Received qualification from {data.get('name', 'unknown')}")
        
        # Append to sheet
        append_to_sheet(data)
        
        # Send notification (best-effort)
        try:
            send_notification(data)
        except Exception as e:
            logger.warning(f"Notification failed: {e}")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "message": "Qualification received.",
                "priority": data.get("priority", "unknown"),
                "fitScore": data.get("fitScore", 0),
            },
        )
    except Exception as e:
        logger.error(f"Qualification error: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
