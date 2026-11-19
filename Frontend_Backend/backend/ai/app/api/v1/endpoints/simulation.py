"""HU-019 / HU-020 / HU-021 / HU-022: simuladores de cabello, maquillaje, uñas, gafas y prendas."""
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.analyzers import mp_runtime as mpr
from app.analyzers import simulation
from app.analyzers.imaging import ALLOWED_MIME, decode_image, jsonable

router = APIRouter()


@router.post("/{kind}", summary="Aplicar una simulación de estilo sobre la foto")
async def simulate(kind: str, file: UploadFile = File(...), options: Optional[str] = Form(None),
                   garment: Optional[UploadFile] = File(None)) -> Dict[str, Any]:
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Se aceptan únicamente imágenes JPG, PNG o WEBP.")
    try:
        opts = json.loads(options) if options else {}
        if not isinstance(opts, dict):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="El campo 'options' debe ser un objeto JSON.")
    data = await file.read()
    try:
        img = decode_image(data, max_side=1024)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    garment_img = None
    if garment is not None:
        if garment.content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=400, detail="La foto de la prenda debe ser JPG, PNG o WEBP.")
        try:
            garment_img = decode_image(await garment.read(), max_side=1024)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    def job():
        out, meta = simulation.simulate(kind, img, opts, garment_img)
        return {"modelVersion": simulation.VERSION, "kind": kind, "options": opts, "meta": meta,
                "imageBase64": simulation.encode_jpeg(out), "mime": "image/jpeg",
                "width": int(out.shape[1]), "height": int(out.shape[0])}

    try:
        return jsonable(await run_in_threadpool(job))
    except mpr.ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "simulacion_fallida", "message": str(exc)})
