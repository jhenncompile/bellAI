"""HU-009 / HU-010: reconocimiento automático de prendas.

- Segmentación: SegFormer-B2 si la prenda la lleva una persona (confirmada con MediaPipe Pose),
  si no el segmentador interactivo de MediaPipe (magic_touch) y, como último respaldo, GrabCut.
- Color (garment_color.py): balance de blancos, k-means por tono, nombre por CIEDE2000 y
  combinación con CLIP. Evaluado con 9 prendas reales x 3 luces: 23-24/27 (antes 9/27).
- Clasificación zero-shot con CLIP (MobileCLIP2-S0) de subcategoría, estampado, estilo y ocasión,
  si open_clip y los pesos están disponibles. Si no, se usa la heurística anterior.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.analyzers import garment_color as gc
from app.analyzers import mp_runtime as mpr
from app.analyzers import onnx_models
from app.analyzers.imaging import jsonable
from app.core.config import settings

log = logging.getLogger(__name__)
VERSION_CLIP = "garment-clip-1.1.0"
VERSION_HEURISTIC = "garment-heuristic-2.2.0"

# Subcategorías de wardrobe_items -> (categoría, descripción en inglés para CLIP)
SUBCATEGORIES: Dict[str, Tuple[str, str]] = {
    "blusas": ("superior", "a women's blouse"),
    "camisas": ("superior", "a button-up shirt"),
    "camisetas": ("superior", "a t-shirt"),
    "tops": ("superior", "a crop top or tank top"),
    "vestidos": ("superior", "a dress"),
    "pantalones": ("inferior", "trousers or dress pants"),
    "jeans": ("inferior", "denim jeans"),
    "faldas": ("inferior", "a skirt"),
    "shorts": ("inferior", "shorts"),
    "chaquetas": ("abrigo", "a casual jacket"),
    "abrigos": ("abrigo", "a long coat"),
    "sueteres": ("abrigo", "a knitted sweater"),
    "blazers": ("abrigo", "a tailored blazer"),
    "zapatillas": ("calzado", "sneakers"),
    "tacones": ("calzado", "high heel shoes"),
    "botas": ("calzado", "boots"),
    "sandalias": ("calzado", "sandals"),
    "bolsos": ("accesorio", "a handbag"),
    "cinturones": ("accesorio", "a belt"),
    "joyeria": ("accesorio", "jewelry such as a necklace or earrings"),
    "sombreros": ("accesorio", "a hat"),
    "bufandas": ("accesorio", "a scarf"),
    "lentes": ("accesorio", "sunglasses or eyeglasses"),
    "relojes": ("accesorio", "a wristwatch"),
}

# Varias frases por clase (se promedian). «_textura» es tela lisa con relieve (denim, punto
# acanalado, costuras, pliegues): CLIP la confundía con rayas o cuadros; cuenta como «liso».
PATTERNS = {
    "liso": ("a plain solid color garment", "a garment in a single solid color with no print", "an unpatterned piece of clothing"),
    "_textura": ("a solid denim garment", "a ribbed knit garment in one color", "a solid garment with visible seams, pleats and stitching"),
    "rayas": ("a striped garment", "a garment with a printed stripe pattern", "clothing with bold stripes"),
    "cuadros": ("a plaid or checkered garment", "a tartan print garment", "a gingham check garment"),
    "floral": ("a floral print garment", "clothing printed with flowers", "a garment with a flower pattern"),
    "lunares": ("a polka dot garment", "clothing with a dotted print", "a garment covered in polka dots"),
    "animal": ("an animal print garment", "a leopard print garment", "a zebra or snake print garment"),
    "geometrico": ("a garment with a geometric print", "a garment with a graphic print or logo", "clothing with an abstract print"),
}
PRINT_MIN = 0.6   # por debajo, un estampado no se declara: falso positivo frecuente en telas con relieve

STYLES = {
    "Clásico": "classic timeless clothing",
    "Minimalista": "minimalist clothing",
    "Romántico": "romantic feminine clothing with ruffles or lace",
    "Casual": "casual everyday clothing",
    "Elegante": "elegant formal clothing",
    "Urbano": "streetwear urban clothing",
    "Deportivo": "sportswear athletic clothing",
    "Bohemio": "bohemian boho clothing",
}

OCCASIONS = {
    "casual": ("clothing for a casual day", "everyday casual wear", "a relaxed weekend outfit piece"),
    "trabajo": ("clothing for the office", "business casual workwear", "a piece of clothing to wear to work"),
    "formal": ("clothing for a formal event", "formal wear for a wedding or ceremony", "an elegant formal garment"),
    "fiesta": ("clothing for a party at night", "a going-out outfit for a night party", "partywear"),
    "deporte": ("clothing for exercising", "athletic sportswear for the gym", "workout clothes"),
    "playa": ("swimwear or beachwear", "a beach cover-up or bikini", "clothing for a day at the beach"),
}

# Clases de SegFormer (ATR): partes del cuerpo y prendas
_BODY_PARTS = (2, 11, 12, 13, 14, 15)          # cabello, rostro, piernas, brazos
_WORN_GARMENTS = (4, 5, 6, 7, 17)              # superior, falda, pantalón, vestido, bufanda


def _pose_detected(img: np.ndarray) -> bool:
    if not mpr.is_available("pose"):
        return False
    try:
        res = mpr.detect_pose(img)
    except Exception:  # noqa: BLE001
        return False
    return any(np.mean([p.visibility for p in lm]) >= 0.5 for lm in (res.pose_landmarks or []))


def worn_garment_mask(img: np.ndarray) -> Optional[np.ndarray]:
    """Máscara de la prenda puesta (ver worn_garment) o None."""
    worn = worn_garment(img)
    return None if worn is None else worn[0]


def worn_garment(img: np.ndarray) -> Optional[Tuple[np.ndarray, int]]:
    """
    Si la prenda la lleva una persona (o un maniquí con brazos/piernas), SegFormer-B2 la separa de
    la piel, el cabello y las otras prendas: así una blusa rosa no se mezcla con la falda negra ni
    un vestido rojo con la pasarela. Devuelve None si no hay persona o el modelo no está.
    """
    if not onnx_models.is_available("clothes_parsing"):
        return None
    try:
        parse = onnx_models.parse_clothes(img)
    except Exception:  # noqa: BLE001 - sin SegFormer se usa el segmentador de objetos
        return None
    # ¿Hay persona? MediaPipe Pose la encuentra aunque sea pequeña (pasarela); SegFormer cubre los
    # torsos recortados sin cara. Por separado fallan: SegFormer ve una «cara» en la etiqueta de
    # unos jeans (0,16 %) y Pose no detecta un torso de espaldas sin cabeza.
    if float(np.isin(parse, _BODY_PARTS).mean()) < 0.01 and not _pose_detected(img):
        return None
    areas = {c: int((parse == c).sum()) for c in _WORN_GARMENTS}
    best = max(areas, key=areas.get)
    if areas[best] < 0.008 * parse.size:
        return None
    m = (parse == best).astype(np.uint8) * 255
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))), best


def garment_mask(img: np.ndarray) -> np.ndarray:
    """Máscara de la prenda (0/255). Ver garment_segmentation."""
    return garment_segmentation(img)[0]


def garment_segmentation(img: np.ndarray) -> Tuple[np.ndarray, str, Optional[int]]:
    """
    Máscara de la prenda (0/255).
    1. Si la lleva una persona: SegFormer-B2 (prendas puestas).
    2. Si no: el segmentador interactivo de MediaPipe señalando el centro de la foto, que separa la
       prenda del fondo, de etiquetas y de sombras mucho mejor que GrabCut.
    3. Si ningún modelo está disponible o el recorte no es plausible: GrabCut.
    Devuelve (máscara, modelo que la produjo, clase ATR de SegFormer si la prenda está puesta).
    """
    worn = worn_garment(img)
    if worn is not None:
        return worn[0], "segformer_b2_clothes", worn[1]
    if mpr.is_available("garment_segmenter"):
        try:
            fg = (mpr.segment_object(img) > 0.5).astype(np.uint8) * 255
            coverage = float(fg.mean()) / 255.0
            if 0.04 <= coverage <= 0.95:
                return fg, "mediapipe_magic_touch", None
        except Exception:  # noqa: BLE001 - el respaldo GrabCut cubre cualquier fallo del modelo
            pass
    return _grabcut_mask(img), "grabcut", None


def _grabcut_mask(img: np.ndarray) -> np.ndarray:
    """Máscara de la prenda con GrabCut iniciado en el rectángulo central."""
    h, w = img.shape[:2]
    scale = 400.0 / max(h, w)
    small = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale)))) if scale < 1 else img.copy()
    sh, sw = small.shape[:2]
    mask = np.zeros((sh, sw), np.uint8)
    rect = (int(sw * 0.06), int(sh * 0.06), int(sw * 0.88), int(sh * 0.88))
    try:
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        # GrabCut inicia k-medias al azar: con semilla fija, la misma foto da la misma máscara
        cv2.setRNGSeed(0)
        cv2.grabCut(small, mask, rect, bgd, fgd, 4, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except cv2.error:
        fg = np.zeros((sh, sw), np.uint8)
    if fg.mean() / 255 < 0.05:  # GrabCut falló: se usa la región central
        fg[:] = 0
        fg[rect[1]:rect[1] + rect[3], rect[0]:rect[0] + rect[2]] = 255
    return cv2.resize(fg, (w, h), interpolation=cv2.INTER_NEAREST)


def nearest_color_name(lab: Tuple[float, float, float]) -> Tuple[str, str]:
    """Nombre (y hex de referencia) del color de la paleta más cercano en CIEDE2000."""
    i = int(np.argmax(gc.measured_probs(lab)))
    return gc.NAMES[i], gc.PALETTE[i][1]


def color_analysis(img: np.ndarray, mask: np.ndarray, k: int = 4) -> Dict[str, Any]:
    """
    Colores medidos de una región (balance de blancos + k-means por tono + CIEDE2000), sin CLIP.
    Lo usan la ropa puesta (SegFormer) y la red siamesa, para nombrar igual que el armario.
    """
    balanced, _ = gc.white_balance(img)
    clusters = gc.measure(balanced, mask, k=k)
    colors = [{"name": c["name"], "hex": c["hex"], "share": round(c["share"], 3), "lab": c["lab"]} for c in clusters]
    multicolor = (
        len(clusters) > 1 and clusters[1]["share"] > 0.22
        and float(gc.ciede2000(np.array([clusters[0]["lab"]]), np.array([clusters[1]["lab"]]))[0, 0]) > 20
    )
    return {"main": colors[0], "colors": colors, "multicolor": bool(multicolor)}


class _Clip:
    """Clasificador zero-shot perezoso (se carga una vez, protegido por lock)."""

    MODEL = os.getenv("GARMENT_CLIP_MODEL", "MobileCLIP2-S0")
    PRETRAINED = os.getenv("GARMENT_CLIP_PRETRAINED", "dfndr2b")

    def __init__(self):
        self._lock = threading.Lock()
        self._state: Optional[dict] = None
        self._failed = False

    @staticmethod
    def _hf_env() -> None:
        """Caché local de pesos y modo sin red. Debe ir ANTES del primer `import open_clip`:
        huggingface_hub lee HF_HUB_OFFLINE al importarse y después ya no lo vuelve a mirar."""
        hf_dir = os.path.join(settings.MODELS_DIR, "hf")
        os.environ.setdefault("HF_HOME", hf_dir)
        if os.path.isdir(hf_dir) and os.getenv("GARMENT_CLIP_ALLOW_DOWNLOAD") != "1":
            os.environ.setdefault("HF_HUB_OFFLINE", "1")  # evita consultas de red: carga en segundos

    def available(self) -> bool:
        if self._failed or os.getenv("GARMENT_CLIP_DISABLED") == "1":
            return False
        self._hf_env()
        try:
            import open_clip  # noqa: F401
        except Exception:  # noqa: BLE001
            return False
        return os.path.isdir(os.path.join(settings.MODELS_DIR, "hf")) or os.getenv("GARMENT_CLIP_ALLOW_DOWNLOAD") == "1"

    def _load(self):
        self._hf_env()
        import open_clip
        import torch
        model, _, preprocess = open_clip.create_model_and_transforms(self.MODEL, pretrained=self.PRETRAINED)
        model.eval()
        tokenizer = open_clip.get_tokenizer(self.MODEL)
        groups = {"sub": SUBCATEGORIES, "pattern": PATTERNS, "style": STYLES, "occasion": OCCASIONS}
        text = {}
        with torch.no_grad():
            # Varias plantillas por clase, promediadas (prompt ensembling): la foto de una prenda
            # puede ser de catálogo, puesta o colgada, y una sola frase favorece un tipo de foto.
            sub_templates = ("a product photo of {}", "a photo of a person wearing {}", "{} hanging on a hanger",
                             "a close-up photo of {}")
            for g, mapping in groups.items():
                keys = list(mapping)
                if g == "sub":
                    feats = []
                    for k in keys:
                        f = model.encode_text(tokenizer([t.format(mapping[k][1]) for t in sub_templates]))
                        f = (f / f.norm(dim=-1, keepdim=True)).mean(0)
                        feats.append(f / f.norm())
                    text[g] = (keys, torch.stack(feats))
                    continue
                if isinstance(mapping[keys[0]], tuple):
                    feats = []
                    for k in keys:
                        f = model.encode_text(tokenizer([f"a product photo of {p}" for p in mapping[k]]))
                        f = (f / f.norm(dim=-1, keepdim=True)).mean(0)
                        feats.append(f / f.norm())
                    text[g] = (keys, torch.stack(feats))
                    continue
                prompts = [f"a product photo of {mapping[k]}" for k in keys]
                feats = model.encode_text(tokenizer(prompts))
                text[g] = (keys, feats / feats.norm(dim=-1, keepdim=True))
            # Color: promedio de varias plantillas por color (prompt ensembling, como en el paper de CLIP)
            templates = ("a photo of a {} garment", "{} clothing", "a {} piece of clothing on a gray background")
            color_feats = []
            for _, _, en in gc.PALETTE:
                f = model.encode_text(tokenizer([t.format(en) for t in templates]))
                f = (f / f.norm(dim=-1, keepdim=True)).mean(0)
                color_feats.append(f / f.norm())
            text["color"] = (gc.NAMES, torch.stack(color_feats))
        self._state = {"model": model, "preprocess": preprocess, "text": text, "torch": torch}

    def zero_shot(self, img_bgr: np.ndarray, classes: Dict[str, tuple], key: str) -> Optional[Dict[str, float]]:
        """
        Clasificación zero-shot genérica: `classes` = {etiqueta: (frase1, frase2, ...)}; las frases
        de cada clase se promedian (prompt ensembling). `key` identifica el juego de clases para
        guardar sus vectores de texto. Devuelve {etiqueta: probabilidad} o None si CLIP no está.
        """
        if not self.available():
            return None
        with self._lock:
            try:
                if self._state is None:
                    self._load()
                st = self._state
                torch = st["torch"]
                cache = st.setdefault("zero_shot", {})
                if key not in cache:
                    import open_clip
                    tok = open_clip.get_tokenizer(self.MODEL)
                    feats = []
                    with torch.no_grad():
                        for phrases in classes.values():
                            t = st["model"].encode_text(tok(list(phrases)))
                            t = (t / t.norm(dim=-1, keepdim=True)).mean(0)
                            feats.append(t / t.norm())
                    cache[key] = (list(classes), torch.stack(feats))
                labels, tf = cache[key]
                from PIL import Image
                pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
                with torch.no_grad():
                    f = st["model"].encode_image(st["preprocess"](pil).unsqueeze(0))
                    f = f / f.norm(dim=-1, keepdim=True)
                    probs = (100.0 * f @ tf.T).softmax(dim=-1)[0].tolist()
                return dict(zip(labels, probs))
            except Exception as exc:  # noqa: BLE001
                log.warning("CLIP (%s) no disponible: %s", key, exc)
                return None

    def color_probs(self, img_bgr: np.ndarray) -> Optional[List[float]]:
        """Probabilidad de cada color de gc.PALETTE según CLIP (None si CLIP no está)."""
        if not self.available():
            return None
        with self._lock:
            try:
                if self._state is None:
                    self._load()
                st = self._state
                from PIL import Image
                torch = st["torch"]
                pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
                with torch.no_grad():
                    f = st["model"].encode_image(st["preprocess"](pil).unsqueeze(0))
                    f = f / f.norm(dim=-1, keepdim=True)
                    return (100.0 * f @ st["text"]["color"][1].T).softmax(dim=-1)[0].tolist()
            except Exception as exc:  # noqa: BLE001
                log.warning("CLIP (color) no disponible: %s", exc)
                return None

    def classify(self, img_bgr: np.ndarray) -> Optional[Dict[str, Any]]:
        if not self.available():
            return None
        with self._lock:
            try:
                if self._state is None:
                    self._load()
                st = self._state
                from PIL import Image
                torch = st["torch"]
                pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
                with torch.no_grad():
                    f = st["model"].encode_image(st["preprocess"](pil).unsqueeze(0))
                    f = f / f.norm(dim=-1, keepdim=True)
                    out = {}
                    for g, (keys, tf) in st["text"].items():
                        if g == "color":
                            continue
                        probs = (100.0 * f @ tf.T).softmax(dim=-1)[0].tolist()
                        pairs = dict(zip(keys, probs))
                        if "_textura" in pairs:   # tela lisa con relieve = liso
                            pairs["liso"] = pairs.get("liso", 0.0) + pairs.pop("_textura")
                        ranked = sorted(pairs.items(), key=lambda x: -x[1])
                        out[g] = [{"label": k, "probability": round(p, 3)} for k, p in ranked[:3]]
                        if g == "sub":
                            out["subDistribution"] = pairs
                return out
            except Exception as exc:  # noqa: BLE001
                log.warning("CLIP no disponible: %s", exc)
                self._failed = True
                return None


    def warmup(self) -> None:
        """Precarga el modelo en segundo plano para que la primera prenda no espere."""
        if self.available() and self._state is None:
            threading.Thread(target=lambda: self.classify(np.full((224, 224, 3), 127, np.uint8)), daemon=True).start()


CLIP = _Clip()


def garment_colors(img_bgr: np.ndarray, mask: np.ndarray) -> Dict[str, Any]:
    """
    Color principal y secundarios de la prenda:
    balance de blancos -> k-means por tono (CIEDE2000) -> combinación con CLIP para el principal.
    """
    balanced, gains = gc.white_balance(img_bgr)
    clusters = gc.measure(balanced, mask)
    main = clusters[0]
    clip_p = CLIP.color_probs(gc.masked_crop(balanced, mask))
    probs, method = gc.fuse(main["probs"], clip_p)
    best = int(np.argmax(probs))
    main_name = gc.NAMES[best]
    # Estampado: dos colores con peso similar y claramente distintos
    multicolor = (
        len(clusters) > 1 and clusters[1]["share"] > 0.22
        and float(gc.ciede2000(np.array([main["lab"]]), np.array([clusters[1]["lab"]]))[0, 0]) > 20
    )
    colors = [{"name": main_name, "hex": main["hex"], "share": round(main["share"], 3)}]
    colors += [{"name": c["name"], "hex": c["hex"], "share": round(c["share"], 3)} for c in clusters[1:] if c["share"] >= 0.06]
    top = np.argsort(-probs)[:3]
    return {
        "color": main_name,
        "colorHex": main["hex"],
        "colorConfidence": round(float(probs[best]), 3),
        "colorAlternatives": [{"name": gc.NAMES[i], "probability": round(float(probs[i]), 3)} for i in top[1:]],
        "colorMethod": method,
        "whiteBalanceGains": gains,
        "colors": colors,
        "multicolor": bool(multicolor),
    }


def analyze(img_bgr: np.ndarray, heuristic_sub: Optional[str] = None, mask: Optional[np.ndarray] = None) -> Dict[str, Any]:
    """Clasifica la prenda. heuristic_sub es la subcategoría de la heurística (respaldo)."""
    if mask is None:
        mask = garment_mask(img_bgr)
    colors = garment_colors(img_bgr, mask)
    x, y, w, h = cv2.boundingRect((mask > 0).astype(np.uint8))
    crop = img_bgr[y:y + h, x:x + w] if w > 10 and h > 10 else img_bgr
    clip = CLIP.classify(crop)
    if clip:
        sub = clip["sub"][0]["label"]
        pattern = clip["pattern"][0]["label"]
        if pattern != "liso" and clip["pattern"][0]["probability"] < PRINT_MIN:
            pattern = "liso"
        result = {
            "modelVersion": VERSION_CLIP,
            "method": "clip_zero_shot",
            "subcategory": sub,
            "category": SUBCATEGORIES[sub][0],
            "confidence": clip["sub"][0]["probability"],
            "alternatives": [{"subcategory": a["label"], "probability": a["probability"]} for a in clip["sub"][1:]],
            "pattern": pattern,
            "style": clip["style"][0]["label"],
            "styles": [s["label"] for s in clip["style"][:2]],
            "occasion": clip["occasion"][0]["label"],
            "clipDistribution": clip.get("subDistribution"),
        }
    else:
        sub = heuristic_sub or "otros"
        result = {
            "modelVersion": VERSION_HEURISTIC,
            "method": "heuristica",
            "subcategory": sub,
            "category": SUBCATEGORIES.get(sub, ("superior", ""))[0],
            # Sin modelo no hay probabilidad que informar
            "confidence": None,
            "alternatives": [],
            "pattern": "estampado" if colors["multicolor"] else "liso",
            "style": None,
            "styles": [],
            "occasion": None,
        }
    multicolor = colors.pop("multicolor")
    if result["method"] == "heuristica":
        result["pattern"] = "estampado" if multicolor else "liso"
    result.update(colors)
    result["maskCoverage"] = round(float((mask > 0).mean()), 3)
    return jsonable(result)
