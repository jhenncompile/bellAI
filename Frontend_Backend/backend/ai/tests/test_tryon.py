"""HU-022 (probador de prendas sobre la foto) y HU-003 (análisis corporal) con una foto real de cuerpo completo."""
import os

import cv2
import numpy as np
import pytest

from app.analyzers import body, simulation
from app.analyzers import mp_runtime as mpr

BODY = os.path.join(os.path.dirname(__file__), "fixtures", "cuerpo_completo.jpg")
needs_pose = pytest.mark.skipif(not mpr.is_available("pose"), reason="Modelo de pose no descargado")


def _shirt(color=(60, 60, 200)):
    g = np.full((700, 560, 3), 235, np.uint8)
    pts = np.array([[150, 120], [410, 120], [470, 220], [420, 250], [400, 620], [160, 620], [140, 250], [90, 220]])
    cv2.fillPoly(g, [pts], color)
    return g


@pytest.fixture(scope="module")
def person():
    img = cv2.imread(BODY)
    assert img is not None
    return img


@needs_pose
@pytest.mark.parametrize("region", ["superior", "inferior", "completo"])
def test_garment_is_placed_on_the_body(person, region):
    out, meta = simulation.simulate("prenda", person, {"region": region}, _shirt())
    assert out.shape == person.shape
    assert meta["region"] == region
    assert 0.03 < meta["coverage"] < 0.6
    # La prenda roja aparece en la foto y la cabeza (tercio superior central) no se tapa
    diff = cv2.absdiff(out, person).sum(axis=2) > 60
    assert diff.mean() > 0.03
    h, w = person.shape[:2]
    assert diff[: h // 12, w // 4: 3 * w // 4].mean() < 0.02


@needs_pose
def test_upper_garment_stays_between_shoulders_and_hips(person):
    out, _ = simulation.simulate("prenda", person, {"region": "superior"}, _shirt())
    diff = cv2.absdiff(out, person).sum(axis=2) > 60
    rows = np.where(diff.any(axis=1))[0]
    h = person.shape[0]
    assert rows.min() > h * 0.05 and rows.max() < h * 0.6


def test_garment_requires_photo_and_valid_region(person):
    with pytest.raises(ValueError, match="Falta la foto de la prenda"):
        simulation.simulate("prenda", person, {"region": "superior"}, None)
    with pytest.raises(ValueError, match="Región no válida"):
        simulation.simulate("prenda", person, {"region": "zapatos"}, _shirt())


@needs_pose
def test_no_body_detected_gives_clear_message():
    blank = np.full((600, 400, 3), 200, np.uint8)
    with pytest.raises(ValueError, match="No se detectó tu cuerpo"):
        simulation.simulate("prenda", blank, {"region": "superior"}, _shirt())


@needs_pose
def test_body_analysis_on_real_full_body_photo(person):
    """HU-003 con una foto real (no sintética): devuelve silueta y medidas coherentes."""
    result = body.analyze(person)
    assert result["bodyType"]
    assert result["metrics"]["hipWidthPx"] > result["metrics"]["waistWidthPx"] * 0.8


@needs_pose
def test_loose_clothing_lowers_confidence_and_warns(person):
    """La foto de prueba lleva un caftán amplio: la cadera se ve inflada y el análisis lo advierte."""
    result = body.analyze(person)
    assert result["metrics"]["hipLooseness"] > body.LOOSE_HIP_RATIO
    assert result["confidence"] <= 0.6
    assert any("holgada" in w for w in result["warnings"])
