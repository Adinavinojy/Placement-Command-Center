from apscheduler.schedulers.background import BackgroundScheduler
from plyer import notification
import time
from datetime import datetime
from core import db

def check_and_notify(window_minutes=30):
    """
    Queries for deadlines due within the window_minutes and triggers notifications.
    """
    upcoming = db.get_upcoming_deadlines(window_minutes)
    if not upcoming:
        return
        
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
            # Mark as notified so we don't repeat
            db.mark_notified(deadline_id)
        except Exception as e:
            print(f"Failed to send notification: {e}")

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
