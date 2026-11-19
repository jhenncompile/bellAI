import io
import os
import sys

# Asegurar que 'backend/ai' esté en el path de Python para importar 'app'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="session")
def client():
    """Cliente de pruebas HTTP para FastAPI."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def sample_image_bytes():
    """Genera bytes de una imagen sintética en formato JPEG usando OpenCV."""
    # Crear imagen sintética RGB 100x100
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Dibujar formas para simular contenido
    cv2.circle(img, (50, 50), 30, (0, 255, 0), -1)
    
    # Codificar a formato JPEG
    success, buffer = cv2.imencode('.jpg', img)
    assert success, "Error al codificar imagen sintética para pruebas"
    return buffer.tobytes()
