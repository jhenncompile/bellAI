"""HU-023: reconstrucción del avatar 3D a partir del escaneo guiado del teléfono."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from app.analyzers import avatar_scan, mannequin
from app.analyzers import mp_runtime as mpr
from app.analyzers.imaging import ALLOWED_MIME, decode_image, jsonable

router = APIRouter()
logger = logging.getLogger(__name__)

FACE_VIEWS = (
    "frente",
    "tres_cuartos_izq",
    "tres_cuartos_der",
    "perfil_izq",
    "perfil_der",
    "arriba",
    "abajo",
    "izquierda",
    "derecha",
)
MAX_TURN_FRAMES = 24
MAX_BYTES = 8 * 1024 * 1024


@router.post("/base-mesh", summary="Maniquí (MakeHuman CC0) con silueta, cabello y ropa según la configuración")
async def generate_base_mesh(request: Request) -> Dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        mesh = await run_in_threadpool(mannequin.build_mesh, body)
        return jsonable(mesh)
    except Exception as exc:
        logger.exception("No se pudo generar el maniquí")
        raise HTTPException(500, f"Error al generar el maniquí: {exc}") from exc


async def _image(f: UploadFile, max_side: int):
    if f.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Formato no admitido en {f.filename}: usa JPG, PNG o WEBP.")
    data = await f.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Una de las fotos supera los 8 MB.")
    try:
        return decode_image(data, max_side=max_side)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/check-body", summary="¿Se ve el cuerpo entero? Comprobación rápida durante el escaneo (HU-023)")
async def check_body(request: Request) -> Dict[str, Any]:
    form = await request.form()
    f = form.get("file")
    if not isinstance(f, UploadFile):
        raise HTTPException(400, "Adjunta la foto en el campo file.")
    img = await _image(f, 960)
    try:
        return await run_in_threadpool(avatar_scan.check_body_photo, img)
    except mpr.ModelUnavailableError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/reconstruct", summary="Avatar 3D con medidas reales a partir del escaneo guiado (HU-023)")
async def reconstruct(request: Request) -> Dict[str, Any]:
    """
    Multipart con:
    - `face_frente` (obligatoria), `face_izquierda`, `face_derecha`, `face_arriba`, `face_abajo`;
    - `tpose` (obligatoria): cuerpo entero en pose T con el teléfono apoyado;
    - `turn_0` … `turn_N`: fotos mientras gira sobre sí misma;
    - `height_cm`: estatura en centímetros.
    Devuelve la malla (posiciones, colores, regiones e índices, en metros), las medidas y la calidad.
    """
    form = await request.form()
    try:
        height_cm = float(str(form.get("height_cm") or "0").replace(",", "."))
    except ValueError:
        height_cm = 0.0
    faces = {}
    for view in FACE_VIEWS:
        f = form.get(f"face_{view}")
        if isinstance(f, UploadFile):
            faces[view] = await _image(f, 1280)
    tpose_file = form.get("tpose")
    if not isinstance(tpose_file, UploadFile):
        raise HTTPException(422, {"code": "sin_pose_t", "message": "Falta la foto de cuerpo entero en pose T."})
    tpose = await _image(tpose_file, 1280)
    turn_files: List[UploadFile] = [v for k, v in form.multi_items() if k.startswith("turn_") and isinstance(v, UploadFile)]
    turns = [await _image(f, 960) for f in turn_files[:MAX_TURN_FRAMES]]

    try:
        result = await run_in_threadpool(avatar_scan.reconstruct, faces, tpose, turns, height_cm)
    except avatar_scan.ScanError as exc:
        raise HTTPException(422, {"code": exc.code, "message": exc.message}) from exc
    except mpr.ModelUnavailableError as exc:
        raise HTTPException(503, str(exc)) from exc
    return jsonable(result)
