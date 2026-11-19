"""HU-023: avatar 3D por escaneo guiado."""
import math
import os

import cv2
import numpy as np
import pytest

from app.analyzers import avatar_mesh as am
from app.analyzers import avatar_scan as scan
from app.analyzers import mannequin

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _jpg(img) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _body():
    # La foto de prueba corta la coronilla: se añade margen arriba para que se vea el cuerpo entero
    return cv2.copyMakeBorder(cv2.imread(os.path.join(FIX, "cuerpo_completo.jpg")), 60, 0, 0, 0, cv2.BORDER_REPLICATE)


def test_elipse_se_recupera_con_varios_giros():
    a, b = 0.16, 0.11
    samples = [(t, 2 * math.sqrt((a * math.cos(t)) ** 2 + (b * math.sin(t)) ** 2)) for t in np.radians([0, 20, 45, 70, 90, 130])]
    fa, fb, fitted = scan.fit_ellipse(samples, 0.7)
    assert fitted and fa == pytest.approx(a, rel=1e-3) and fb == pytest.approx(b, rel=1e-3)


def test_elipse_sin_giro_usa_la_proporcion_por_defecto():
    fa, fb, fitted = scan.fit_ellipse([(0.0, 0.3), (0.05, 0.3)], 0.7)
    assert not fitted and fa == pytest.approx(0.15, rel=1e-2) and fb == pytest.approx(0.105, rel=1e-2)


def test_perimetro_ramanujan():
    assert scan.ellipse_perimeter(1, 1) == pytest.approx(2 * math.pi)
    assert scan.ellipse_perimeter(0.15, 0.1) == pytest.approx(0.7933, abs=1e-3)


def test_triangulos_de_la_cara():
    assert scan.FACE_TRIS.shape == (852, 3) and scan.FACE_TRIS.max() < 468
    assert len(scan.FACE_OVAL) == 36


def test_tubo_cerrado_tiene_normales_hacia_fuera():
    mb = am.MeshBuilder()
    am.loft(mb, [(0, 0, 0), (0, 1, 0)], [(0.2, 0.2), (0.2, 0.2)], (200, 150, 120), 4, seg=12)
    pos, _, reg, tri = mb.arrays()
    t = pos[tri]
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    out = t.mean(axis=1) - np.array([0, 0.5, 0])
    assert (np.einsum("ij,ij->i", n, out) > 0).all()
    assert set(reg.tolist()) == {4}


def test_reconstruye_avatar_con_medidas(tmp_path):
    face = cv2.imread(os.path.join(FIX, "retrato.jpg"))
    body = _body()
    r = scan.reconstruct({"frente": face}, body, [body], 165)
    pos = np.array(r["mesh"]["positions"]).reshape(-1, 3)
    idx = np.array(r["mesh"]["indices"])
    assert idx.max() < len(pos) and len(r["mesh"]["regions"]) == len(pos) == len(r["mesh"]["colors"]) // 3
    # Maniquí escalado a la estatura (el cabello puede sobresalir un poco de la coronilla)
    assert pos[:, 1].min() == pytest.approx(0, abs=0.02) and pos[:, 1].max() == pytest.approx(1.65, abs=0.03)
    assert r["mannequin"]["preset"] in mannequin.PRESETS
    m = r["measurements"]
    assert 60 < m["cinturaCm"] < m["caderaCm"] < 130 and 70 < m["pechoCm"] < 130
    assert r["appearance"]["skinHex"].startswith("#")
    # Sin giro ni pose T, lo dice en vez de inventar precisión
    assert any("pose T" in w for w in r["quality"]["warnings"])


def test_estatura_fuera_de_rango():
    with pytest.raises(scan.ScanError) as e:
        scan.reconstruct({"frente": np.zeros((10, 10, 3), np.uint8)}, np.zeros((10, 10, 3), np.uint8), [], 90)
    assert e.value.code == "estatura"


def test_api_pide_la_pose_t(client):
    r = client.post("/api/v1/avatar/reconstruct", data={"height_cm": "165"},
                    files={"face_frente": ("f.jpg", _jpg(cv2.imread(os.path.join(FIX, "retrato.jpg"))), "image/jpeg")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "sin_pose_t"


def test_api_cuerpo_incompleto_explica_que_hacer(client):
    face = _jpg(cv2.imread(os.path.join(FIX, "retrato.jpg")))
    r = client.post("/api/v1/avatar/reconstruct", data={"height_cm": "165"},
                    files={"face_frente": ("f.jpg", face, "image/jpeg"), "tpose": ("t.jpg", face, "image/jpeg")})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "cuerpo_incompleto"
    assert "dos metros y medio" in r.json()["detail"]["message"]


def test_chequeo_dice_que_se_corta_la_cabeza(client):
    # La foto de prueba original corta la coronilla
    raw = _jpg(cv2.imread(os.path.join(FIX, "cuerpo_completo.jpg")))
    r = client.post("/api/v1/avatar/check-body", files={"file": ("t.jpg", raw, "image/jpeg")})
    assert r.status_code == 200 and r.json()["ok"] is False and r.json()["code"] == "cabeza_cortada"
    r = client.post("/api/v1/avatar/check-body", files={"file": ("t.jpg", _jpg(_body()), "image/jpeg")})
    assert r.json()["ok"] is True and r.json()["tpose"] is False


def test_pies_cortados():
    body = _body()
    cut = body[: int(body.shape[0] * 0.8)]
    assert scan.body_problem(scan.body_frame(cut)) == "pies_cortados"


def test_si_la_pose_t_falla_usa_una_foto_del_giro():
    face = cv2.imread(os.path.join(FIX, "retrato.jpg"))
    r = scan.reconstruct({"frente": face}, cv2.imread(os.path.join(FIX, "cuerpo_completo.jpg")), [_body()], 165)
    assert any("usamos una del giro" in w for w in r["quality"]["warnings"])


def test_api_devuelve_malla(client):
    body = _jpg(_body())
    r = client.post("/api/v1/avatar/reconstruct", data={"height_cm": "165"},
                    files=[("face_frente", ("f.jpg", _jpg(cv2.imread(os.path.join(FIX, "retrato.jpg"))), "image/jpeg")),
                           ("tpose", ("t.jpg", body, "image/jpeg")), ("turn_0", ("0.jpg", body, "image/jpeg"))])
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["units"] == "m" and j["mesh"]["regionNames"]["rostro"] == 1 and j["quality"]["turnFramesUsed"] == 1
