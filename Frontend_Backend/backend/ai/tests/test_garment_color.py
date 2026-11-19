"""Color de prendas (HU-015): CIEDE2000, balance de blancos, textura y combinación con CLIP."""
import os

import cv2
import numpy as np
import pytest

from app.analyzers import garment
from app.analyzers import garment_color as gc
from app.analyzers import mp_runtime as mpr
from app.analyzers import onnx_models

FIX = os.path.join(os.path.dirname(__file__), "fixtures")
DENIM = {"Denim", "Azul marino", "Azul"}


def _img(name):
    return cv2.imread(os.path.join(FIX, name))


def _cast(img, gains_bgr):
    return np.clip(img.astype(np.float32) * np.array(gains_bgr, np.float32), 0, 255).astype(np.uint8)


WARM = (0.72, 0.92, 1.12)   # bombilla incandescente
COOL = (1.15, 1.0, 0.82)    # sombra / fluorescente frío


@pytest.mark.parametrize("lab1,lab2,expected", [
    # Pares de verificación de Sharma, Wu y Dalal (2005)
    ((50, 2.6772, -79.7751), (50, 0, -82.7485), 2.0425),
    ((50, 0, 0), (50, -1, 2), 2.3669),
    ((50, 2.5, 0), (73, 25, -18), 27.1492),
    ((22.7233, 20.0904, -46.694), (23.0331, 14.973, -42.5619), 2.0373),
    ((90.8027, -2.0831, 1.441), (91.1528, -1.6435, 0.0447), 1.4441),
])
def test_ciede2000_coincide_con_la_referencia(lab1, lab2, expected):
    d = gc.ciede2000(np.array([lab1], float), np.array([lab2], float))[0, 0]
    assert abs(d - expected) < 1e-3


def test_denim_oscuro_no_se_llama_gris():
    """Con CIE76 un denim oscuro (L≈23, b≈-8) quedaba más cerca de «Gris oscuro» que de «Azul marino»."""
    assert garment.nearest_color_name((23.0, 1.0, -8.0))[0] in DENIM
    assert garment.nearest_color_name((5.0, 0.0, 0.0))[0] == "Negro"


def _gray_scene(cast=(1, 1, 1)):
    """Escena con tarjetas grises de distinta luminosidad y un objeto rojo, bajo una luz dada."""
    img = np.full((240, 320, 3), 200, np.uint8)
    for i, v in enumerate((40, 90, 140, 230)):
        cv2.rectangle(img, (10 + 75 * i, 10), (70 + 75 * i, 90), (v, v, v), -1)
    cv2.rectangle(img, (40, 120), (280, 230), (40, 40, 190), -1)
    return _cast(img, cast)


@pytest.mark.parametrize("light", [WARM, COOL])
def test_balance_de_blancos_quita_la_dominante(light):
    scene = _gray_scene(light)
    balanced, _ = gc.white_balance(scene)
    spread = lambda im: np.ptp(im[20:80, 165:215].reshape(-1, 3).astype(float).mean(0))  # tarjeta gris 140
    # La tarjeta gris recupera al menos el 70 % de su neutralidad (con un objeto rojo en escena)
    assert spread(balanced) < 0.3 * spread(scene), (spread(scene), spread(balanced))


def test_balance_de_blancos_no_altera_una_foto_neutra():
    _, gains = gc.white_balance(_gray_scene())
    assert max(abs(g - 1) for g in gains) < 0.05


def test_textura_jaspeada_se_ve_como_un_color():
    """Un punto verde con motas oscuras y amarillas salía «Negro» o «Turquesa» por k-means."""
    rng = np.random.default_rng(0)
    img = np.full((300, 300, 3), (70, 130, 50), np.uint8)               # verde (BGR)
    noise = rng.random((300, 300))
    img[noise < 0.25] = (15, 35, 15)                                      # huecos oscuros del punto
    img[noise > 0.9] = (60, 200, 200)                                     # motas amarillas
    mask = np.zeros((300, 300), np.uint8)
    mask[30:270, 30:270] = 255
    main = gc.measure(img, mask)[0]
    assert main["name"] in {"Verde", "Esmeralda", "Verde militar", "Verde oliva"}
    assert main["share"] > 0.6


# Las fotos reales necesitan el segmentador de prendas y CLIP: con GrabCut la máscara incluye el
# fondo blanco y las etiquetas, y sin CLIP no se recupera el rosa «percibido» de una foto apagada.
needs_models = pytest.mark.skipif(
    not (mpr.is_available("garment_segmenter") and garment.CLIP.available()),
    reason="Segmentador de prendas o CLIP no descargados",
)


@needs_models
def test_jeans_reales_son_azules_con_cualquier_luz():
    img = _img("prenda_jeans.jpg")
    for light in ((1, 1, 1), WARM, COOL):
        assert garment.analyze(_cast(img, light))["color"] in DENIM


@needs_models
def test_blusa_rosa_con_luz_de_tienda_no_es_gris():
    """En píxeles crudos mide RGB(176,163,154): gris beige. Con la luz corregida es rosa."""
    r = garment.analyze(_img("prenda_blusa_rosa.jpg"))
    assert r["color"] in {"Rosa palo", "Rosa pastel", "Nude", "Durazno", "Salmón", "Coral"}
    assert r["colorAlternatives"] and 0 < r["colorConfidence"] <= 1


def test_la_fusion_con_clip_mantiene_el_hex_medido():
    measured = gc.measured_probs((23.0, 1.0, -8.0))
    clip = np.full(len(gc.NAMES), 1e-3)
    clip[gc.NAMES.index("Azul marino")] = 1.0
    probs, method = gc.fuse(measured, clip / clip.sum())
    assert gc.NAMES[int(np.argmax(probs))] == "Azul marino"
    assert method == "medicion_ciede2000+clip"
    # Sin CLIP decide solo la medida
    assert gc.fuse(measured, None)[1] == "medicion_ciede2000"


@pytest.mark.skipif(not onnx_models.is_available("clothes_parsing") or not mpr.is_available("pose"),
                    reason="SegFormer o MediaPipe Pose no descargados")
def test_prenda_puesta_se_separa_de_la_persona():
    img = _img("cuerpo_completo.jpg")                                    # caftán largo
    worn = garment.worn_garment_mask(img)
    assert worn is not None and 0.05 < (worn > 0).mean() < 0.8


@pytest.mark.skipif(not onnx_models.is_available("clothes_parsing"), reason="SegFormer no descargado")
def test_prenda_sin_persona_no_usa_segformer():
    """SegFormer ve una «cara» en la etiqueta de unos jeans: sin persona real no debe usarse."""
    assert garment.worn_garment_mask(_img("prenda_jeans.jpg")) is None
    assert garment.worn_garment_mask(_img("prenda_blusa_rosa.jpg")) is None


@needs_models
@pytest.mark.parametrize("name", ["prenda_jeans.jpg", "prenda_gabardina.jpg", "prenda_blusa_rosa.jpg"])
def test_telas_lisas_con_relieve_no_son_estampado(name):
    # El denim y la gabardina salían «rayas» y «cuadros»: el motor de outfits penaliza dos
    # estampados juntos, así que un falso estampado estropeaba combinaciones válidas.
    img = cv2.imread(os.path.join(FIX, name))
    assert garment.analyze(img)["pattern"] == "liso"
