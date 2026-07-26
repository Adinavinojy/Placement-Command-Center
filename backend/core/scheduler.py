from apscheduler.schedulers.background import BackgroundScheduler
from plyer import notification
import time
from datetime import datetime
from core import db

def check_and_notify(window_minutes=30):
    """
    Queries for deadlines due within the window_minutes and triggers notifications.
    """
    import json
    from pathlib import Path
    users_file = Path(__file__).resolve().parent.parent / "users.json"
    if not users_file.exists():
        return
    try:
        users = json.loads(users_file.read_text(encoding="utf-8"))
    except Exception:
        return
        
    for email in users.keys():
        upcoming = db.get_upcoming_deadlines(email, window_minutes)
        if not upcoming:
            continue
            
        for row in upcoming:
            deadline_id = row['id']
            company = row['company']
            title = row['title']
            due_at = row['due_at']
            
            try:
                due_dt = datetime.fromisoformat(due_at)
                time_str = due_dt.strftime("%H:%M")
            except ValueError:
                time_str = due_at
                
            msg = f"{title} at {time_str}"
            
            try:
                notification.notify(
                    title=f"PCC: {company}",
                    message=msg,
                    app_name="Placement Command Center",
                    timeout=10
                )
            except Exception as e:
                # Desktop notifications will fail on headless cloud servers (Render)
                print(f"Skipped desktop notification (cloud environment): {e}")
            finally:
                # Always mark as notified so we don't spam the logs every 5 minutes
                db.mark_notified(email, deadline_id)

_scheduler = None

def start_scheduler():
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
        # Run every 5 minutes
        _scheduler.add_job(check_and_notify, 'interval', minutes=5)
        _scheduler.start()

def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown()
        _scheduler = None
