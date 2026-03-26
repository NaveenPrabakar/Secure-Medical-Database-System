from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class PatientCreate(BaseModel):
    name: str
    dob: str | None = None
    notes: str | None = None

@router.get('/')
def list_patients():
    return {'items': []}

@router.post('/')
def create_patient(payload: PatientCreate):
    return {'id': 1, **payload.model_dump()}
