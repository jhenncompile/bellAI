"""Motor de recomendación: red siamesa ResNet-34 + armonía de color."""
import os

import pytest

from app.models.recommendation import RecommendationModelManager, color_harmony, cosine

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _bytes(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return f.read()


@pytest.fixture(scope="module")
def manager():
    return RecommendationModelManager(device="cpu")


def test_misma_prenda_es_identica_para_la_red(manager):
    a = _bytes("prenda_jeans.jpg")
    r = manager.match_outfit_compatibility(a, a)
    assert r["cosineSimilarity"] > 0.999
    assert r["visualSimilarity"] == 1.0


def test_prendas_distintas_son_menos_parecidas(manager):
    same = manager.match_outfit_compatibility(_bytes("prenda_jeans.jpg"), _bytes("prenda_jeans.jpg"))
    diff = manager.match_outfit_compatibility(_bytes("prenda_jeans.jpg"), _bytes("prenda_gabardina.jpg"))
    assert diff["cosineSimilarity"] < same["cosineSimilarity"]
    assert 0 <= diff["compatibilityScore"] <= 100
    assert diff["vectorDimensions"] == 512
    assert diff["colorRule"] in ("base_neutra", "colores_analogos", "colores_complementarios", "contraste_arriesgado")


def test_armonia_de_color():
    assert color_harmony("#808080", "#C2410C")[1] == "base_neutra"
    assert color_harmony("#C2410C", "#B45309")[1] == "colores_analogos"
    assert color_harmony("#1D4ED8", "#EAB308")[1] == "colores_complementarios"


def test_rank_ordena_por_compatibilidad(manager):
    anchor = manager.embed(_bytes("prenda_jeans.jpg"))
    result = manager.rank(anchor, {"igual": anchor, "otra": manager.embed(_bytes("prenda_gabardina.jpg"))})
    assert [r["itemId"] for r in result["results"]] == ["igual", "otra"]


def test_vectores_de_distinta_dimension():
    with pytest.raises(ValueError):
        cosine([1.0, 0.0], [1.0, 0.0, 0.0])
