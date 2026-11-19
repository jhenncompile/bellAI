import os
from pydantic_settings import BaseSettings

_DEFAULT_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models"))


class Settings(BaseSettings):
    PROJECT_NAME: str = "BellAI - Servicio de IA"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"

    # Directorio de artefactos de modelos (MediaPipe .task/.tflite, ONNX, etc.)
    MODELS_DIR: str = os.getenv("MODELS_DIR", _DEFAULT_MODELS_DIR)

    # Configuración de ejecución (cpu o cuda)
    DEVICE: str = os.getenv("AI_DEVICE", "cpu")

    # Umbrales por defecto
    CONFIDENCE_THRESHOLD: float = 0.5

    # Configuración de CORS restringido (cerrado wildcard * para TEC-06 / RNF-01)
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173,http://localhost",
        ).split(",")
        if origin.strip()
    ]
    # Clave compartida opcional con el backend NestJS (cabecera X-Internal-Key)
    INTERNAL_API_KEY: str = os.getenv("AI_INTERNAL_KEY", "")

    class Config:
        case_sensitive = True


settings = Settings()
