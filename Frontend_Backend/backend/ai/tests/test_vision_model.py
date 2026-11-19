"""Modelos de /vision: ResNet-34 (ImageNet) real y delegación en MediaPipe."""
import os

import cv2
import pytest
import torch

from app.analyzers import mp_runtime as mpr
from app.models.resnet_garment import IMAGENET_TO_SUBCATEGORY, RESNET_GARMENT
from app.models.vision import VisionModelManager
from app.models.weights import imagenet_categories, load_resnet34

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _bytes(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return f.read()


@pytest.fixture(scope="module")
def manager():
    return VisionModelManager(device="cpu")


def test_resnet34_carga_pesos_completos_de_imagenet():
    model = load_resnet34()
    assert model.fc.out_features == 1000
    # La capa de salida está entrenada: su dispersión es mucho mayor que la de pesos al azar
    init_std = (1 / 512) ** 0.5 / 3 ** 0.5
    assert float(model.fc.weight.std()) > 2 * init_std


def test_mapeo_de_clases_existe_en_imagenet():
    cats = set(imagenet_categories())
    for names in IMAGENET_TO_SUBCATEGORY.values():
        assert set(names) <= cats


@pytest.mark.parametrize("fixture,expected", [("prenda_gabardina.jpg", "abrigos"), ("prenda_jeans.jpg", "jeans")])
def test_resnet34_reconoce_prendas_reales(fixture, expected):
    r = RESNET_GARMENT.classify(cv2.imread(os.path.join(FIX, fixture)))
    assert r["subcategory"] == expected
    assert r["probability"] > 0.5


def test_vector_de_caracteristicas_normalizado():
    v = RESNET_GARMENT.embed(cv2.imread(os.path.join(FIX, "prenda_jeans.jpg")))
    assert v.shape == (512,)
    assert abs(float((v ** 2).sum()) - 1.0) < 1e-4


def test_predict_devuelve_clases_de_imagenet(manager):
    result = manager.predict(_bytes("prenda_gabardina.jpg"))
    assert result["model_type"] == "resnet34_imagenet"
    assert result["predicted_class"] == "trench coat"
    assert len(result["all_scores"]) == 5
    assert 0.0 < result["confidence"] <= 1.0


def test_analyze_garment_usa_la_probabilidad_del_modelo(manager):
    result = manager.analyze_garment(_bytes("prenda_gabardina.jpg"))
    assert result["subcategory"] == "abrigos"
    assert result["category"] == "abrigo"
    assert result["method"].startswith("resnet34_imagenet")
    # La confianza es la probabilidad real de ResNet-34, no un valor fijo
    assert result["confidence"] >= result["resnet34"]["probability"] - 1e-3   # 3 vs 4 decimales
    assert result["resnet34"]["imagenetTop5"][0]["label"] == "trench coat"
    assert len(result["feature_vector"]) == 512
    assert result["color_hex"].startswith("#")
    assert len(result["enhanced_image_base64"]) > 100


def test_sin_prenda_reconocible_no_inventa_confianza(manager, sample_image_bytes):
    """Un círculo verde no es una prenda: o decide CLIP con su probabilidad, o no hay confianza."""
    result = manager.analyze_garment(sample_image_bytes)
    if result["method"] == "heuristica":
        assert result["confidence"] is None
        assert result["lowConfidence"] is True
    else:
        assert 0.0 <= result["confidence"] <= 1.0


def test_imagen_invalida(manager):
    with pytest.raises(ValueError):
        manager.predict(b"bytes_no_validos_que_no_son_imagen")


@pytest.mark.skipif(not mpr.is_available("segmenter"), reason="Segmentador de MediaPipe no descargado")
def test_cabello_con_mediapipe(manager):
    result = manager.segment_hair(_bytes("cuerpo_completo.jpg"))
    assert result["model_type"] in ("mediapipe_selfie_multiclass", "bisenet_resnet18_face_parsing")
    assert result["coveragePercentage"] > 0


@pytest.mark.skipif(not mpr.is_available("pose"), reason="Modelo de pose no descargado")
def test_cuerpo_rechaza_foto_no_apta_con_el_motivo(manager):
    """La foto de prueba mide 420 px (mínimo 480): se rechaza explicando por qué, sin inventar medidas."""
    with pytest.raises(ValueError, match="resoluci"):
        manager.analyze_body(_bytes("cuerpo_completo.jpg"))


def test_tensor_de_entrada():
    t = RESNET_GARMENT.to_tensor(cv2.imread(os.path.join(FIX, "prenda_jeans.jpg")))
    assert isinstance(t, torch.Tensor) and t.shape == (1, 3, 224, 224)


@pytest.mark.skipif(not mpr.is_available("garment_segmenter"), reason="Segmentador de prendas no descargado")
def test_segmentador_de_prenda_mide_el_color_de_la_tela():
    """Con GrabCut, la etiqueta y el fondo blanco hacían que unos jeans midieran «blanco»."""
    from app.analyzers import garment
    img = cv2.imread(os.path.join(FIX, "prenda_jeans.jpg"))
    mask = garment.garment_mask(img)
    assert 0.04 < (mask > 0).mean() < 0.95
    L = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[..., 0][mask > 0]
    assert float(L.mean()) * 100 / 255 < 50   # denim oscuro, no blanco


@pytest.mark.skipif(not mpr.is_available("pose"), reason="Modelo de pose no descargado")
def test_pose_prefiere_el_modelo_full_si_existe():
    import os as _os
    from app.core.config import settings
    expected = "pose_landmarker_full.task" if _os.path.exists(_os.path.join(settings.MODELS_DIR, "pose_landmarker_full.task")) else "pose_landmarker_lite.task"
    assert mpr.model_file("pose") == expected


from app.analyzers import onnx_models  # noqa: E402


@pytest.mark.skipif(not onnx_models.is_available("face_parsing"), reason="Face parsing ONNX no descargado")
def test_face_parsing_separa_piel_cabello_y_sombrero():
    from app.analyzers import quality
    img = cv2.imread(os.path.join(FIX, "retrato.jpg"))
    rep = quality.validate(img, "rostro")
    parse = onnx_models.parse_face(img, rep.face_landmarks)
    assert parse.shape == img.shape[:2]
    assert (parse == onnx_models.FP_SKIN).mean() > 0.03
    assert (parse == onnx_models.FP_HAT).mean() > 0.02          # la foto de prueba lleva gorra
    assert (parse == onnx_models.FP_GLASSES).sum() > 0          # y gafas


@pytest.mark.skipif(not onnx_models.is_available("face_parsing"), reason="Face parsing ONNX no descargado")
def test_colorimetria_usa_face_parsing_y_detecta_accesorios():
    from app.analyzers import color, quality
    img = cv2.imread(os.path.join(FIX, "retrato.jpg"))
    r = color.analyze(img, quality.validate(img, "rostro").face_landmarks)
    assert r["segmentationModel"] == "bisenet_resnet18_face_parsing"
    assert r["accessories"] == {"glasses": True, "hat": True}


@pytest.mark.skipif(not onnx_models.is_available("clothes_parsing"), reason="SegFormer de ropa no descargado")
def test_ropa_puesta_con_segformer(manager):
    r = manager.analyze_outfit(_bytes("cuerpo_completo.jpg"))   # caftán largo
    assert r["model_type"] == "segformer_b2_clothes"
    assert r["garments"][0]["subcategory"] == "vestidos"
    assert r["garments"][0]["colorHex"].startswith("#")


def test_ropa_puesta_sin_modelo_responde_que_falta(manager, monkeypatch):
    monkeypatch.setitem(onnx_models.FILES, "clothes_parsing", "no_existe.onnx")
    with pytest.raises(mpr.ModelUnavailableError):
        manager.analyze_outfit(_bytes("cuerpo_completo.jpg"))
