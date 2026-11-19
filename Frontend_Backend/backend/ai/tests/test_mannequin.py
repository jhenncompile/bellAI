"""HU-023: avatar maniquí (MakeHuman CC0)."""
import pytest

from app.analyzers import mannequin


def test_preset_desde_silueta_del_analisis():
    assert mannequin.preset_from("Pera") == "pera"
    assert mannequin.preset_from("Triángulo invertido") == "triangulo_invertido"
    assert mannequin.preset_from("Reloj de arena") == "reloj"
    assert mannequin.preset_from("manzana") == "redondo"
    assert mannequin.preset_from(None) == mannequin.DEFAULT_PRESET


def test_clave_de_cabello():
    assert mannequin.hair_key({"hairLength": "Largo", "hairStyle": "Ondulado", "hairFringe": True}) == "gen:largo:ondulado:fleco"
    assert mannequin.hair_key({"hairStyle": "Bob"}) == "gen:corto:lacio:sin"


@pytest.fixture(scope="module")
def malla():
    return mannequin.build_mesh({"preset": "pera", "hairLength": "Medio"})


def test_sin_prendas_lleva_la_ropa_generica(malla):
    assert [g["kind"] for g in malla["garments"]] == ["blusa_basica", "short"]


def test_malla_portable(malla):
    caras = len(malla["indices"]) // 3 + sum(len(g["indices"]) // 3 for g in malla["garments"])
    assert caras < 60000
    assert malla["regionNames"]["hombro"] == 12
    assert len(malla["regions"]) == len(malla["positions"]) // 3 == len(malla["colors"]) // 3


def test_prendas_pedidas_y_tipos_desconocidos():
    m = mannequin.build_mesh({"preset": "reloj", "garments": [{"kind": "vestido", "color": "#B66A50"}, {"kind": "capa"}]})
    assert [g["kind"] for g in m["garments"]] == ["vestido"]
    assert m["garments"][0]["color"] == [182, 106, 80]


def test_escaneo_ajusta_el_maniqui():
    base = {"estaturaCm": 160.0, "anchoHombrosCm": 36.0}
    assert mannequin.fit_from_measurements({**base, "pechoCm": 86, "cinturaCm": 66, "caderaCm": 104})["preset"] == "pera"
    assert mannequin.fit_from_measurements({**base, "pechoCm": 104, "cinturaCm": 74, "caderaCm": 92})["preset"] == "triangulo_invertido"
    assert mannequin.fit_from_measurements({**base, "pechoCm": 94, "cinturaCm": 68, "caderaCm": 96})["preset"] == "reloj"
    assert mannequin.fit_from_measurements({**base, "pechoCm": 92, "cinturaCm": 80, "caderaCm": 94})["preset"] == "rectangulo"
    assert mannequin.fit_from_measurements({**base, "pechoCm": 100, "cinturaCm": 96, "caderaCm": 102})["preset"] == "redondo"
    fit = mannequin.fit_from_measurements({**base, "pechoCm": 200, "cinturaCm": 40, "caderaCm": 96})
    assert 0.85 <= fit["bustScale"] <= 1.15 and 0.85 <= fit["waistScale"] <= 1.15
    assert fit["heightScale"] == round(160 / 168, 2)
