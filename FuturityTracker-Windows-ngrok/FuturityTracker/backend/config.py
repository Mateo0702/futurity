from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
BASE = Path(__file__).resolve().parent
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE / '.env', extra='ignore')
    APP_NAME: str = 'Futurity Tracker API'
    DATABASE_URL: str = 'sqlite:///' + str(BASE / 'futurity_tracker.db')
    ADMIN_TOKEN: str = ''
    OFFLINE_THRESHOLD_SECONDS: int = Field(default=180, ge=120)
    CORS_ORIGINS: str = ''
settings = Settings()
