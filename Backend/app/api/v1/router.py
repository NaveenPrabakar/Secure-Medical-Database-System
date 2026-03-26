from fastapi import APIRouter
from app.api.v1.endpoints import auth, patients, audit

api_router = APIRouter()
api_router.include_router(auth.router, prefix='/auth', tags=['auth'])
api_router.include_router(patients.router, prefix='/patients', tags=['patients'])
api_router.include_router(audit.router, prefix='/audit', tags=['audit'])
