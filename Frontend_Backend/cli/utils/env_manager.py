"""Gestor de archivos de entorno (.env) para BellAI."""
import os
from typing import Dict, Optional

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
BACKEND_ENV = os.path.join(BASE_DIR, "backend", ".env")
BACKEND_ENV_EXAMPLE = os.path.join(BASE_DIR, "backend", ".env.example")
FRONTEND_ENV = os.path.join(BASE_DIR, "Frontend", ".env")
AI_ENV = os.path.join(BASE_DIR, "backend", "ai", ".env")


def leer_env(ruta: str) -> Dict[str, str]:
    """Lee un archivo .env y devuelve un diccionario con sus claves y valores."""
    if not os.path.exists(ruta):
        return {}
    res = {}
    with open(ruta, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                res[k.strip()] = v.strip().strip('"').strip("'")
    return res


def fijar_env(ruta: str, clave: str, valor: str) -> None:
    """Modifica o agrega clave=valor en un archivo .env preservando comentarios."""
    lineas = []
    if os.path.exists(ruta):
        with open(ruta, "r", encoding="utf-8") as f:
            lineas = f.read().splitlines()
    
    nueva_linea = f"{clave}={valor}"
    encontrado = False
    for i, l in enumerate(lineas):
        stripped = l.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k = stripped.split("=", 1)[0].strip()
            if k == clave:
                lineas[i] = nueva_linea
                encontrado = True
                break
    if not encontrado:
        lineas.append(nueva_linea)
    
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")


def asegurar_backend_env() -> Dict[str, str]:
    """Si backend/.env no existe, lo inicializa a partir de backend/.env.example."""
    if not os.path.exists(BACKEND_ENV) and os.path.exists(BACKEND_ENV_EXAMPLE):
        with open(BACKEND_ENV_EXAMPLE, "r", encoding="utf-8") as fe, open(BACKEND_ENV, "w", encoding="utf-8") as fb:
            fb.write(fe.read())
    return leer_env(BACKEND_ENV)


def get_backend_config() -> Dict[str, str]:
    """Devuelve la configuración consolidada del backend."""
    cfg = leer_env(BACKEND_ENV)
    if not cfg:
        cfg = asegurar_backend_env()
    return cfg
