from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    supabase_url: str = ""
    supabase_key: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    sharepoint_tenant_id: str = ""
    sharepoint_client_id: str = ""
    sharepoint_client_secret: str = ""
    dropbox_access_token: str = ""
    dropbox_folder_path: str = "/Artwork Proofing"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"


settings = Settings()
