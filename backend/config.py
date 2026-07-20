import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.database_url: str = os.getenv("DATABASE_URL", "")
        self.master_encryption_key: str = os.getenv("MASTER_ENCRYPTION_KEY", "")
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
        self.anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
        self.google_api_key: str | None = os.getenv("GOOGLE_API_KEY")
        self.groq_api_key: str | None = os.getenv("GROQ_API_KEY")
        self.groq_admin_key: str | None = os.getenv("GROQ_ADMIN_KEY")
        self.deepseek_api_key: str | None = os.getenv("DEEPSEEK_API_KEY")
        self.cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]
        self.default_user_email: str = os.getenv("DEFAULT_USER_EMAIL", "dev@disha.local")
        self.default_user_name: str = os.getenv("DEFAULT_USER_NAME", "Disha Developer")


def get_settings() -> Settings:
    return Settings()