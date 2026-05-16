from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://financas:financas@db:5432/financas"
    app_password: str = "changeme"
    secret_key: str = "changeme-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
