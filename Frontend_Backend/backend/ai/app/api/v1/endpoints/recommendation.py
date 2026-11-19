from typing import Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.recommendation import RecommendationModelManager
from app.models.weights import WeightsUnavailableError

router = APIRouter()
rec_manager = RecommendationModelManager(device=settings.DEVICE)

ALLOWED = ("image/jpeg", "image/png", "image/webp")


class RankRequest(BaseModel):
    anchor: List[float] = Field(..., min_length=8, description="Vector de la prenda de referencia")
    candidates: Dict[str, List[float]] = Field(..., min_length=1, description="id de prenda -> vector")
    top_k: int = Field(default=5, ge=1, le=50)
    anchor_hex: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    candidate_hex: Optional[Dict[str, str]] = None


async def _image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Se aceptan únicamente imágenes JPG, PNG o WEBP.")
    return await file.read()


@router.post("/match-compatibility", summary="Compatibilidad de dos prendas (red siamesa ResNet-34 + armonía de color)")
async def match_outfit_compatibility_endpoint(
    garment_a: UploadFile = File(..., description="Fotografía de la primera prenda"),
    garment_b: UploadFile = File(..., description="Fotografía de la segunda prenda"),
    name_a: Optional[str] = Form("Prenda superior"),
    name_b: Optional[str] = Form("Prenda inferior"),
):
    """
    Pasa las dos fotos por el mismo ResNet-34 (pesos compartidos), compara sus vectores de 512
    dimensiones con similitud coseno y lo combina con la armonía de sus colores medidos.
    """
    a, b = await _image(garment_a), await _image(garment_b)
    try:
        return await run_in_threadpool(rec_manager.match_outfit_compatibility, a, b, name_a or "Prenda superior", name_b or "Prenda inferior")
    except WeightsUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/embed", summary="Vector de 512 dimensiones de una prenda (rama de la red siamesa)")
async def embed_endpoint(file: UploadFile = File(...)):
    data = await _image(file)
    try:
        vector = await run_in_threadpool(rec_manager.embed, data)
    except WeightsUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"model_type": "siamese_resnet34", "dimensions": len(vector), "vector": vector}


@router.post("/rank", summary="Ordena prendas por compatibilidad usando vectores ya calculados")
async def rank_endpoint(req: RankRequest):
    try:
        return rec_manager.rank(req.anchor, req.candidates, req.top_k, req.anchor_hex, req.candidate_hex)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
