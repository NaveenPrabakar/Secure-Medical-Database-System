from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = 'Secure Medical Database System'
    DATABASE_URL: str = 'sqlite:///./medical.db'
    SECRET_KEY: str = 'change-me'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
