"""Endpoints de diagnóstico morfológico: validación, rostro, colorimetría y cuerpo.

Todas las rutas validan primero la foto (HU-035). Si no cumple las condiciones mínimas se
responde 422 con los problemas concretos y no se ejecuta el análisis.
"""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.analyzers import body, color, face, garment, quality
from app.analyzers import mp_runtime as mpr
from app.analyzers.imaging import ALLOWED_MIME, decode_image, jsonable

router = APIRouter()


def _thresholds(raw: Optional[str]) -> Dict[str, float]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El campo 'thresholds' debe ser JSON.")


async def _read(file: UploadFile):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Se aceptan únicamente imágenes JPG, PNG o WEBP.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen supera los 10 MB.")
    try:
        return decode_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _guard(report: quality.QualityReport):
    if not report.valid:
        raise HTTPException(status_code=422, detail={"code": "foto_invalida", "quality": report.as_dict()})


def _wrap(fn, *args):
    try:
        return fn(*args)
    except mpr.ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "analisis_fallido", "message": str(exc)})


@router.post("/validate", summary="Validar condiciones de la foto (HU-035)")
async def validate_photo(
    file: UploadFile = File(...),
    type: str = Form("rostro"),
    thresholds: Optional[str] = Form(None),
) -> Dict[str, Any]:
    img = await _read(file)
    t = _thresholds(thresholds)
    report = await run_in_threadpool(_wrap, quality.validate, img, type, t)
    return report.as_dict()


@router.post("/face", summary="Análisis facial + colorimetría + cabello (HU-002, HU-004, HU-006)")
async def analyze_face(file: UploadFile = File(...), thresholds: Optional[str] = Form(None)) -> Dict[str, Any]:
    img = await _read(file)
    t = _thresholds(thresholds)

    def job():
        report = quality.validate(img, "rostro", t)
        _guard(report)
        return {
            "quality": report.as_dict(),
            "face": face.analyze(img, report.face_landmarks),
            "colorimetry": color.analyze(img, report.face_landmarks),
        }

    return jsonable(await run_in_threadpool(_wrap, job))


@router.post("/colorimetry", summary="Solo colorimetría personal (HU-004)")
async def analyze_colorimetry(file: UploadFile = File(...), thresholds: Optional[str] = Form(None)) -> Dict[str, Any]:
    img = await _read(file)
    t = _thresholds(thresholds)

    def job():
        report = quality.validate(img, "rostro", t)
        _guard(report)
        return {"quality": report.as_dict(), "colorimetry": color.analyze(img, report.face_landmarks)}

    return jsonable(await run_in_threadpool(_wrap, job))


@router.post("/body", summary="Análisis corporal y de proporciones (HU-003)")
async def analyze_body(file: UploadFile = File(...), thresholds: Optional[str] = Form(None)) -> Dict[str, Any]:
    img = await _read(file)
    t = _thresholds(thresholds)

    def job():
        report = quality.validate(img, "cuerpo", t)
        _guard(report)
        return {"quality": report.as_dict(), "body": body.analyze(img)}

    return jsonable(await run_in_threadpool(_wrap, job))


@router.post("/garment", summary="Clasificación rápida de una prenda (HU-010, HU-024)")
async def analyze_garment_fast(file: UploadFile = File(...), thresholds: Optional[str] = Form(None)) -> Dict[str, Any]:
    """Valida la foto y devuelve categoría, color, estampado y estilo sin generar imagen de estudio."""
    img = await _read(file)
    t = _thresholds(thresholds)

    def job():
        report = quality.validate(img, "prenda", t)
        _guard(report)
        return {"quality": report.as_dict(), "garment": garment.analyze(img)}

    return jsonable(await run_in_threadpool(_wrap, job))
