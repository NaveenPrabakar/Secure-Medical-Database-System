from app.db.session import SessionLocal
from app.db.models import AuditLog


def log_action(actor: str, action: str, resource: str) -> None:
    db = SessionLocal()
    try:
        db.add(AuditLog(actor=actor, action=action, resource=resource))
        db.commit()
    finally:
        db.close()
