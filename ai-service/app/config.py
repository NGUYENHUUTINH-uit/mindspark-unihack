"""
config.py — Cấu hình tập trung cho ai-service.
Đọc biến môi trường từ file .env bằng pydantic-settings.
Dùng hàm get_settings() để lấy singleton (cached).
"""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",        # Đọc từ .env trong thư mục chạy uvicorn
        env_file_encoding="utf-8",
        extra="ignore",         # Bỏ qua biến môi trường không khai báo ở đây
    )

    # --- API Keys ---
    groq_api_key: str = "mock_groq_key"
    gemini_api_key: str = "mock_gemini_key"

    # --- Model names (đọc từ .env, có default an toàn) ---
    stt_model: str = "whisper-large-v3-turbo"
    llm_model: str = "gemini-3.5-flash-lite"

    # --- Oracle ---
    oracle_service_url: str = "http://localhost:4020"
    oracle_api_key: str = "mindspark-internal-secret-2026"
    oracle_mock: bool = False   # True → dùng proof giả khi dev

    # --- CORS ---
    # Nhiều origin cách nhau bởi dấu phẩy, ví dụ: "http://localhost:3000,https://app.example.com"
    cors_origins: str = "http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_cors(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        """Trả danh sách origin sau khi tách chuỗi."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Singleton settings — chỉ đọc .env một lần.
    Trong test, dùng get_settings.cache_clear() để reset.
    """
    return Settings()

