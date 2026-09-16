from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    MONGO_URL: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "nextgen_portal"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET_KEY: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_ENV: str = "development"
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
