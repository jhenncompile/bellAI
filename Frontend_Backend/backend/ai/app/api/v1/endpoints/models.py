"""HU-032 / HU-043: consulta de analizadores registrados y comprobación de compatibilidad."""
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.analyzers import registry

router = APIRouter()


@router.get("", summary="Analizadores registrados con su versión y disponibilidad")
async def list_models():
    return [info.as_dict() for info in registry.REGISTRY.values()]


@router.get("/{name}/check", summary="Comprobar que un analizador carga y responde")
async def check_model(name: str):
    try:
        return await run_in_threadpool(registry.check, name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No existe el analizador '{name}'.")
