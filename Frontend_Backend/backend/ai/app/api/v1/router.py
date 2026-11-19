from fastapi import APIRouter
from app.api.v1.endpoints import analysis, avatar, models, recommendation, simulation, vision

api_router = APIRouter()

# Registro de routers desacoplados
api_router.include_router(analysis.router, prefix="/analysis", tags=["Diagnóstico morfológico"])
api_router.include_router(simulation.router, prefix="/simulate", tags=["Simulación y probador virtual"])
api_router.include_router(avatar.router, prefix="/avatar", tags=["Avatar 3D"])
api_router.include_router(models.router, prefix="/models", tags=["Registro de modelos"])
api_router.include_router(vision.router, prefix="/vision", tags=["Computer Vision"])
api_router.include_router(recommendation.router, prefix="/recommendations", tags=["Recommendation Engine"])
