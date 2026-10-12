"""Configuration settings for ResilienceSim 3D backend."""
from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "ResilienceSim 3D API"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = (
        "High-performance discrete-event simulation and constrained recovery "
        "optimization backend for supply chain resilience."
    )
    API_V1_STR: str = "/api"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


settings = Settings()
