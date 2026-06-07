import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
_PORT = int(os.getenv("SMTP_PORT", "587"))
_USER = os.getenv("SMTP_USER", "")
_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_FROM = os.getenv("EMAIL_FROM", "")


def _send_sync(to: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _FROM
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP(_HOST, _PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(_USER, _PASSWORD)
        server.sendmail(_FROM, to, msg.as_string())


async def sendConfirmationEmail(to_email: str, name: str) -> bool:
    subject = "Welcome to StockWise AI"
    body = (
        f"<h2>Welcome, {name}!</h2>"
        "<p>Your StockWise AI account has been created successfully.</p>"
        "<p>You can now log in and start exploring AI-powered stock predictions.</p>"
    )
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, body)
        return True
    except Exception:
        return False


async def sendEmailAlert(
    to_email: str,
    ticker: str,
    condition: str,
    target_price: float,
    current_price: float,
) -> bool:
    subject = f"StockWise AI - Price Alert Triggered: {ticker}"
    body = (
        f"<h2>Price Alert: {ticker}</h2>"
        f"<p>Your condition <b>{condition} {target_price}</b> has been met.</p>"
        f"<p>Current price: <b>{current_price}</b></p>"
    )
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, body)
        return True
    except Exception:
        return False


async def sendPendingEmailNotification(to_email: str, message: str) -> bool:
    subject = "StockWise AI - Notification"
    body = f"<p>{message}</p>"
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, body)
        return True
    except Exception:
        return False
