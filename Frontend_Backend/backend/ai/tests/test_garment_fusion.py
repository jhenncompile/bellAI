"""Fusión del tipo de prenda: ResNet-34 + CLIP + SegFormer (app/models/garment_fusion.py)."""
import pytest

from app.models import garment_fusion as gf

SUBS = ["blusas", "camisetas", "chaquetas", "jeans", "faldas", "vestidos", "pantalones"]


def test_clip_seguro_gana_a_resnet_dudoso():
    # Caso real: chaqueta de cuero negra. ResNet dice «jean» (0,59 con 0,64 de prenda); CLIP, chaqueta (0,80)
    p = gf.fuse(SUBS, resnet={"jeans": 0.59, "camisetas": 0.01}, resnet_garment_prob=0.64,
                clip={"chaquetas": 0.80, "jeans": 0.15, "blusas": 0.05})
    assert max(p, key=p.get) == "chaquetas"


def test_si_coinciden_la_confianza_sube():
    solo_clip = gf.fuse(SUBS, clip={"jeans": 0.7, "pantalones": 0.3})
    ambos = gf.fuse(SUBS, resnet={"jeans": 0.95}, resnet_garment_prob=0.95, clip={"jeans": 0.7, "pantalones": 0.3})
    assert ambos["jeans"] > solo_clip["jeans"]


def test_un_solo_modelo_conserva_su_probabilidad():
    p = gf.fuse(SUBS, clip={"faldas": 0.6, "vestidos": 0.4})
    assert p["faldas"] == pytest.approx(0.6, abs=1e-3)


def test_segformer_descarta_lo_incompatible():
    # CLIP duda entre falda y vestido; SegFormer ve un vestido puesto (clase ATR 7)
    p = gf.fuse(SUBS, clip={"faldas": 0.52, "vestidos": 0.48}, segformer_class=7)
    assert max(p, key=p.get) == "vestidos"
    # Una clase que no restringe (p. ej. calzado) no cambia nada
    assert gf.fuse(SUBS, clip={"faldas": 0.52, "vestidos": 0.48}, segformer_class=9)["faldas"] == pytest.approx(0.52, abs=1e-3)


def test_sin_modelos_reparte_por_igual():
    p = gf.fuse(SUBS)
    assert all(v == pytest.approx(1 / len(SUBS)) for v in p.values())
