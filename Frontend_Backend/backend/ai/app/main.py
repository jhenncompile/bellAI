import hmac

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.v1.router import api_router
from app.analyzers.mp_runtime import status as mp_status
from app.models.weights import status as weights_status
from app.analyzers.onnx_models import status as onnx_status

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Microservicio desacoplado para modelos de Inteligencia Artificial (Visión por Computadora y Recomendación).",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS restringido para integración segura con el resto de la plataforma (TEC-06 / RNF-01)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.middleware("http")
async def internal_key_guard(request: Request, call_next):
    """HU-034: si AI_INTERNAL_KEY está definida, solo el backend puede invocar la API de IA."""
    expected = settings.INTERNAL_API_KEY
    if expected and request.url.path.startswith(settings.API_V1_STR):
        given = request.headers.get("x-internal-key", "")
        if not hmac.compare_digest(given, expected):
            return JSONResponse(status_code=401, content={"detail": "Acceso no autorizado al servicio de IA."})
    return await call_next(request)


# Endpoint de comprobación de salud para AWS ECS / ELB y Docker Healthcheck
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "device": settings.DEVICE,
        "models": {**mp_status(), **weights_status(), **onnx_status()},
    }

@app.on_event("startup")
async def warmup_models():
    import os
    if os.getenv("GARMENT_CLIP_WARMUP", "1") == "1":
        try:
            from app.analyzers.garment import CLIP
            CLIP.warmup()
        except Exception:
            pass


# Montaje de las rutas v1 y api
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
