from fastapi import APIRouter

router = APIRouter()

@router.get('/')
def list_audit_logs():
    return {'items': []}
