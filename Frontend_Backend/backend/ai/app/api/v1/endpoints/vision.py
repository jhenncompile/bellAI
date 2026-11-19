from typing import Any, Callable, Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.analyzers import mp_runtime as mpr
from app.core.config import settings
from app.models.vision import VisionModelManager
from app.models.weights import WeightsUnavailableError

router = APIRouter()
vision_manager = VisionModelManager(device=settings.DEVICE)

ALLOWED = ("image/jpeg", "image/png", "image/webp")


class VisionPredictionResponse(BaseModel):
    model_type: str
    model_version: str
    predicted_class: str
    confidence: float
    all_scores: Dict[str, float]


async def _bytes(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Se aceptan únicamente imágenes JPG, PNG o WEBP.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen supera los 10 MB.")
    return data


async def _run(fn: Callable[..., Dict[str, Any]], *args, **kwargs) -> Dict[str, Any]:
    """Ejecuta el modelo fuera del bucle de eventos y traduce los errores a HTTP."""
    try:
        return await run_in_threadpool(fn, *args, **kwargs)
    except (mpr.ModelUnavailableError, WeightsUnavailableError) as exc:
        # Falta un modelo: se dice, en vez de devolver un resultado inventado
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/predict", response_model=VisionPredictionResponse, summary="Clasificación ImageNet con ResNet-34")
async def predict_image(file: UploadFile = File(...)):
    """Las 5 clases de ImageNet más probables según ResNet-34 (resnet34_pretrained.pt)."""
    return await _run(vision_manager.predict, await _bytes(file))


@router.post("/analyze-garment", summary="Tipo y color de una prenda (ResNet-34 + CLIP) e imagen tipo catálogo (HU-009/HU-015)")
async def analyze_garment_endpoint(file: UploadFile = File(...)):
    """
    `method` indica qué modelo decidió el tipo: resnet34_imagenet, resnet34_imagenet+clip,
    clip_zero_shot o heuristica (sin modelo: `confidence` es null).
    """
    data = await _bytes(file)
    return await _run(vision_manager.analyze_garment, data, filename_hint=file.filename or "")


@router.post("/analyze-face", summary="Rostro y colorimetría (MediaPipe Face Landmarker)")
async def analyze_face_endpoint(file: UploadFile = File(...)):
    return await _run(vision_manager.analyze_face, await _bytes(file))


@router.post("/analyze-hair", summary="Segmentación del cabello (MediaPipe selfie_multiclass)")
async def analyze_hair_endpoint(file: UploadFile = File(...)):
    return await _run(vision_manager.segment_hair, await _bytes(file))


@router.post("/analyze-outfit", summary="Prendas que lleva puestas y su color (SegFormer-B2, ATR)")
async def analyze_outfit_endpoint(file: UploadFile = File(...)):
    return await _run(vision_manager.analyze_outfit, await _bytes(file))


@router.post("/analyze-body", summary="Proporciones corporales (MediaPipe Pose, 33 puntos clave)")
async def analyze_body_endpoint(file: UploadFile = File(...)):
    return await _run(vision_manager.analyze_body, await _bytes(file))


@router.post("/virtual-tryon", summary="Probador 2D: la prenda se ajusta a hombros y caderas (MediaPipe Pose)")
async def virtual_tryon_endpoint(
    person: UploadFile = File(...),
    garment: UploadFile = File(...),
    category: str = Form("superior"),
):
    person_bytes, garment_bytes = await _bytes(person), await _bytes(garment)
    return await _run(vision_manager.virtual_tryon, person_bytes, garment_bytes, category=category)


@router.post("/virtual-makeup", summary="Maquillaje según subtono sobre los puntos del rostro (MediaPipe)")
async def virtual_makeup_endpoint(
    face: UploadFile = File(...),
    style: str = Form("natural_calido"),
    undertone: str = Form("Calido"),
):
    return await _run(vision_manager.virtual_makeup, await _bytes(face), style=style, undertone=undertone)
