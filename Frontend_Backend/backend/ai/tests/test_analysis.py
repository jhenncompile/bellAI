"""Pruebas del diagnóstico morfológico (HU-002, HU-003, HU-004, HU-035, HU-043)."""
import os

import cv2
import numpy as np
import pytest

from app.analyzers import body, color, face, quality, registry
from app.analyzers import mp_runtime as mpr
from app.analyzers.imaging import decode_image, delta_e, dominant_colors, hex_to_lab, jsonable
from app.analyzers.palettes import PALETTES, SEASONS

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "retrato.jpg")
needs_models = pytest.mark.skipif(not (mpr.is_available("face") and mpr.is_available("segmenter")),
                                  reason="Modelos MediaPipe no descargados")


@pytest.fixture(scope="module")
def portrait_bytes():
    with open(FIXTURE, "rb") as fh:
        return fh.read()


def _encode(img):
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


# ---------- Validación (HU-035) ----------

def test_dark_photo_is_rejected_before_inference():
    img = np.full((800, 600, 3), 15, np.uint8)
    rep = quality.validate(img, "rostro")
    assert not rep.valid
    codes = {p["code"] for p in rep.as_dict()["problems"]}
    assert "iluminacion_baja" in codes
    # No se llegó a ejecutar la detección de rostro
    assert rep.face_landmarks is None


def test_low_resolution_and_blur_detected():
    img = np.full((200, 200, 3), 128, np.uint8)
    rep = quality.validate(img, "prenda").as_dict()
    codes = {p["code"] for p in rep["problems"]}
    assert {"resolucion", "nitidez"} <= codes
    assert rep["message"]


def test_thresholds_are_configurable():
    img = np.full((200, 200, 3), 128, np.uint8)
    img[::4] = 60
    rep = quality.validate(img, "prenda", {"min_short_side_px": 100, "min_sharpness": 1, "min_contrast_std": 1})
    assert rep.valid


def test_invalid_photo_type():
    with pytest.raises(ValueError):
        quality.validate(np.zeros((10, 10, 3), np.uint8), "mascota")


@needs_models
def test_portrait_passes_validation(portrait_bytes):
    rep = quality.validate(decode_image(portrait_bytes), "rostro")
    assert rep.valid, rep.as_dict()["problems"]
    assert rep.face_landmarks.shape == (478, 2)


@needs_models
def test_no_face_in_blank_image():
    rng = np.random.default_rng(1)
    img = rng.integers(60, 200, (800, 600, 3), dtype=np.uint8)
    rep = quality.validate(img, "rostro").as_dict()
    assert "rostro_no_detectado" in {p["code"] for p in rep["problems"]}


# ---------- Rostro (HU-002) ----------

def test_face_classifier_prototypes_map_to_themselves():
    for name, (r, j, f) in face.PROTOTYPES.items():
        out = face.classify({"lengthToWidth": r, "jawToCheek": j, "foreheadToCheek": f})
        assert out["shape"] == name
        assert 0 < out["confidence"] <= 1


@needs_models
def test_face_analysis_on_portrait(portrait_bytes):
    out = face.analyze(decode_image(portrait_bytes))
    assert out["faceShape"] in face.PROTOTYPES
    assert 0 < out["confidence"] <= 1
    assert out["recommendations"]["cortes"]
    assert "lengthToWidth" in out["metrics"]
    feats = out["features"]
    assert feats["eyes"]["tilt"] in ("Caídos", "Horizontales", "Hacia arriba")
    assert feats["reliable"] is True   # retrato frontal


@needs_models
def test_rasgos_no_cambian_al_inclinar_la_cabeza(portrait_bytes):
    img = decode_image(portrait_bytes)
    res = mpr.detect_faces(img)
    lm = mpr.landmarks_px(res.face_landmarks[0], img.shape[1], img.shape[0])
    base = face.facial_features(lm)["metrics"]
    c = lm.mean(0)
    for deg in (-12, 12):
        t = np.radians(deg)
        rot = (lm - c) @ np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]]).T + c
        m = face.facial_features(rot)["metrics"]
        assert m["eyeTiltDeg"] == pytest.approx(base["eyeTiltDeg"], abs=0.3)
        assert m["eyeSpacing"] == pytest.approx(base["eyeSpacing"], abs=0.01)


def test_rasgos_ojos_caidos_y_labios_finos_sinteticos():
    lm = np.zeros((478, 2))
    # Ojo derecho (izquierda de la imagen): lagrimal (100,100), esquina externa más baja (60,106)
    lm[133], lm[33], lm[159], lm[145] = (100, 100), (60, 106), (80, 94), (80, 108)
    lm[362], lm[263], lm[386], lm[374] = (148, 100), (188, 106), (168, 94), (168, 108)
    # Boca ancha y labios finos
    lm[61], lm[291], lm[0], lm[13], lm[14], lm[17] = (90, 160), (160, 160), (125, 156), (125, 159), (125, 160), (125, 164)
    out = face.facial_features(lm)
    assert out["eyes"]["tilt"] == "Caídos"
    assert out["lips"]["volume"] == "Finos"
    assert any("sube" in t or "suba" in t for t in out["makeupTips"])


# ---------- Colorimetría (HU-004/006) ----------

def test_all_seasons_have_complete_palettes():
    assert len(SEASONS) == 12
    for s in SEASONS:
        p = PALETTES[s]
        cats = {c["category"] for c in p["colors"]}
        assert cats == {"base", "neutro", "acento"}
        assert p["avoid"] and p["metals"]


def test_season_rules():
    assert color._season(-0.9, 0.1, 0.1)[0] == "Invierno Frio (True Winter)"
    assert color._season(0.9, 0.2, 0.1)[0] == "Primavera Calida (True Spring)"
    assert color._season(0.1, -0.9, 0.0)[0] == "Otono Fuerte (Deep Autumn)"
    assert color._season(-0.1, 0.9, 0.0)[0] == "Verano Claro (Light Summer)"
    assert color._season(-0.2, 0.1, 0.9)[0] == "Invierno Brillante (Clear Winter)"
    assert color._season(0.2, 0.1, -0.9)[0] == "Otono Suave (Soft Autumn)"


@needs_models
def test_colorimetry_on_portrait(portrait_bytes):
    out = color.analyze(decode_image(portrait_bytes))
    assert out["season"] in SEASONS
    assert out["undertone"] in {"Calido", "Frio", "Neutro"}
    assert out["contrastLevel"] in {"Alto", "Medio", "Bajo"}
    assert out["colors"]["palette"] and out["colors"]["toxicColors"]
    assert out["skinHex"].startswith("#")


# ---------- Cuerpo (HU-003) ----------

def _synthetic_body(shoulder, waist, hip, h=1000, w=600):
    """Landmarks y máscara sintéticos: torso con anchos dados a la altura de hombro/cintura/cadera."""
    lm = np.zeros((33, 2), np.float32)
    cx = w // 2
    sh_y, hip_y, ank_y = 250, 520, 950
    lm[body.L_SH] = [cx - shoulder / 2, sh_y]
    lm[body.R_SH] = [cx + shoulder / 2, sh_y]
    lm[body.L_HIP] = [cx - hip / 4, hip_y]
    lm[body.R_HIP] = [cx + hip / 4, hip_y]
    lm[body.L_ANK] = [cx - 40, ank_y]
    lm[body.R_ANK] = [cx + 40, ank_y]
    mask = np.zeros((h, w), bool)
    waist_y = sh_y + int(0.7 * (hip_y - sh_y))
    for y in range(sh_y - 20, hip_y + 120):
        if y <= waist_y:
            t = (y - sh_y) / max(1, waist_y - sh_y)
            width = shoulder + (waist - shoulder) * max(0, t)
        else:
            t = (y - waist_y) / max(1, hip_y - waist_y)
            width = waist + (hip - waist) * min(1, t)
        half = int(width / 2)
        mask[y, cx - half:cx + half] = True
    return lm, mask


@pytest.mark.parametrize("dims,expected", [
    ((200, 130, 200), "Reloj de Arena (Hourglass)"),
    ((170, 140, 220), "Triangulo / Pera"),
    ((230, 170, 180), "Triangulo Invertido"),
    ((200, 180, 205), "Rectangular / Atletica"),
    ((200, 205, 205), "Oval / Manzana"),
])
def test_body_classification(dims, expected):
    lm, mask = _synthetic_body(*dims)
    m = body.measure(lm, mask)
    assert body.classify(m)["bodyType"] == expected


def test_body_measure_descuenta_brazos_a_los_costados_pero_no_delante():
    # Reloj de arena con los brazos pegados a los costados: sin descontarlos, la cintura sale
    # tan ancha como la cadera y la silueta parece rectangular.
    lm, mask = _synthetic_body(200, 130, 200)
    h, w = mask.shape
    cx = w // 2
    arms = np.zeros_like(mask)
    rows = slice(int(lm[body.L_SH][1]) + 20, int(lm[body.L_HIP][1]) + 40)
    for side in (-1, 1):
        x0 = cx + side * 60   # solapa con la cintura (130 px): el brazo toca el costado
        arms[rows, min(x0, x0 + side * 34):max(x0, x0 + side * 34)] = True
    with_arms = mask | arms
    assert body.classify(body.measure(lm, with_arms))["bodyType"] != "Reloj de Arena (Hourglass)"
    m = body.measure(lm, with_arms, torso=with_arms & ~arms)
    assert body.classify(m)["bodyType"] == "Reloj de Arena (Hourglass)"
    # Una mano o un bolso delante del torso no adelgaza la cintura
    front = np.zeros_like(mask)
    front[rows, cx - 20:cx + 20] = True
    m_front = body.measure(lm, mask, torso=mask & ~front)
    assert m_front["waistWidthPx"] == pytest.approx(body.measure(lm, mask)["waistWidthPx"])


def test_body_measure_fails_without_mask():
    lm, _ = _synthetic_body(200, 150, 200)
    with pytest.raises(ValueError):
        body.measure(lm, np.zeros((1000, 600), bool))


# ---------- Utilidades y registro (HU-043) ----------

def test_color_utils():
    assert delta_e(hex_to_lab("#FFFFFF"), hex_to_lab("#FFFFFF")) < 1
    assert delta_e(hex_to_lab("#000000"), hex_to_lab("#FFFFFF")) > 90
    img = np.zeros((60, 60, 3), np.uint8)
    img[:, :40] = (0, 0, 200)
    cols = dominant_colors(img, k=2)
    assert cols[0]["share"] > cols[1]["share"]
    assert jsonable({"a": np.float32(1.5), "b": [np.bool_(True)]}) == {"a": 1.5, "b": [True]}


def test_registry_lists_versions():
    names = {i.as_dict()["name"] for i in registry.REGISTRY.values()}
    assert {"quality", "face", "colorimetry", "body"} <= names
    with pytest.raises(KeyError):
        registry.check("inexistente")


# ---------- API ----------

@needs_models
def test_api_face_endpoint(client, portrait_bytes):
    r = client.post("/api/v1/analysis/face", files={"file": ("r.jpg", portrait_bytes, "image/jpeg")})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["quality"]["valid"] and data["face"]["faceShape"] and data["colorimetry"]["season"]


def test_api_face_rejects_dark_photo(client):
    dark = _encode(np.full((800, 600, 3), 10, np.uint8))
    r = client.post("/api/v1/analysis/face", files={"file": ("d.jpg", dark, "image/jpeg")})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "foto_invalida"


def test_api_validate_and_models(client):
    dark = _encode(np.full((800, 600, 3), 10, np.uint8))
    r = client.post("/api/v1/analysis/validate", files={"file": ("d.jpg", dark, "image/jpeg")}, data={"type": "cuerpo"})
    assert r.status_code == 200 and r.json()["valid"] is False
    r = client.post("/api/v1/analysis/validate", files={"file": ("d.jpg", dark, "image/jpeg")}, data={"thresholds": "{nojson"})
    assert r.status_code == 400
    r = client.get("/api/v1/models")
    assert r.status_code == 200 and len(r.json()) >= 4
    assert client.get("/api/v1/models/nada/check").status_code == 404


@needs_models
def test_api_model_check(client):
    r = client.get("/api/v1/models/face/check")
    assert r.status_code == 200 and r.json()["compatible"] is True


# ---------- Prendas (HU-010) ----------

def _garment_image(color_bgr, stripes=False):
    img = np.full((500, 400, 3), 235, np.uint8)
    cv2.rectangle(img, (90, 80), (310, 430), color_bgr, -1)
    if stripes:
        for y in range(80, 430, 30):
            cv2.rectangle(img, (90, y), (310, y + 14), (250, 250, 250), -1)
    return img


def test_garment_color_and_mask():
    from app.analyzers import garment
    img = _garment_image((40, 40, 200))  # rojo en BGR
    mask = garment.garment_mask(img)
    assert 0.2 < (mask > 0).mean() < 0.8
    col = garment.color_analysis(img, mask)
    assert col["main"]["name"] in {"Rojo", "Coral", "Vino", "Terracota"}


def test_garment_heuristic_fallback(monkeypatch):
    from app.analyzers import garment
    monkeypatch.setenv("GARMENT_CLIP_DISABLED", "1")
    out = garment.analyze(_garment_image((120, 60, 20), stripes=True), heuristic_sub="camisas")
    assert out["method"] == "heuristica"
    assert out["subcategory"] == "camisas" and out["category"] == "superior"
    assert out["colorHex"].startswith("#")
    assert garment.nearest_color_name((5.0, 0.0, 0.0))[0] == "Negro"


def test_api_garment_fast(client, monkeypatch):
    monkeypatch.setenv("GARMENT_CLIP_DISABLED", "1")
    img = np.full((600, 500, 3), 230, np.uint8)
    cv2.rectangle(img, (120, 100), (380, 520), (90, 40, 20), -1)
    rng = np.random.default_rng(2)
    img = np.clip(img.astype(int) + rng.integers(-25, 25, img.shape), 0, 255).astype(np.uint8)
    r = client.post("/api/v1/analysis/garment", files={"file": ("p.jpg", _encode(img), "image/jpeg")})
    assert r.status_code == 200, r.text
    g = r.json()["garment"]
    assert g["colorHex"].startswith("#") and g["category"]


# ---------- Simulaciones (HU-019, HU-020, HU-021) ----------

@needs_models
@pytest.mark.parametrize("kind,opts", [
    ("color_cabello", {"color": "#B5532A", "intensity": 1}),
    ("color_cabello", {"color": "#E8C27A", "style": "balayage"}),
    ("maquillaje", {"lips": "#B3122E", "blush": "#F4A6A0", "eyeshadow": "#6B4F3A"}),
    ("gafas", {"style": "cat-eye", "color": "#8B1E1E"}),
    ("gafas", {"style": "aviador", "color": "#C9A227", "tint": 0.4}),
])
def test_simulations_change_the_photo(portrait_bytes, kind, opts):
    from app.analyzers import simulation
    img = decode_image(portrait_bytes)
    out, meta = simulation.simulate(kind, img, opts)
    assert out.shape == img.shape
    assert float(np.abs(out.astype(int) - img.astype(int)).mean()) > 0.05
    assert meta


def test_simulation_errors():
    from app.analyzers import simulation
    with pytest.raises(ValueError):
        simulation.simulate("tatuaje", np.zeros((10, 10, 3), np.uint8), {})
    with pytest.raises(ValueError):
        simulation.hex_to_bgr("rojo")


@needs_models
def test_api_simulation(client, portrait_bytes):
    r = client.post("/api/v1/simulate/gafas", files={"file": ("r.jpg", portrait_bytes, "image/jpeg")}, data={"options": '{"style":"redondas"}'})
    assert r.status_code == 200, r.text
    assert len(r.json()["imageBase64"]) > 1000
    r = client.post("/api/v1/simulate/unas", files={"file": ("r.jpg", portrait_bytes, "image/jpeg")})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "simulacion_fallida"
