"""Descarga los modelos oficiales de MediaPipe que usan los analizadores de BellAI.

Uso:  python scripts/download_models.py [directorio_destino] [--with-clip] [--with-onnx]
Por defecto se guardan en ./models (o en MODELS_DIR si está definida).
"""
import hashlib
import os
import sys
import urllib.request

BASE = "https://storage.googleapis.com/mediapipe-models"
MODELS = {
    "face_landmarker.task": f"{BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "pose_landmarker_lite.task": f"{BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    # Más preciso que "lite" para las proporciones corporales (HU-003); si está, se usa este
    "pose_landmarker_full.task": f"{BASE}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    # Recorte de la prenda señalando el centro de la foto (HU-010, HU-022, HU-024)
    "magic_touch.tflite": f"{BASE}/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite",
    "selfie_multiclass_256x256.tflite": f"{BASE}/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
    "hand_landmarker.task": f"{BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
}

# Modelos ONNX específicos (se ejecutan con onnxruntime; el mismo archivo sirve en el teléfono).
# Tras descargar se comprueba su SHA-256 (ONNX_SHA256) para no ejecutar un archivo alterado.
ONNX_MODELS = {
    # BiSeNet + ResNet-18, CelebAMask-HQ (19 clases del rostro). Licencia MIT. ~53 MB
    "face_parsing_resnet18.onnx": "https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx",
    # SegFormer-B2 entrenado en ATR (ropa puesta). Licencia NVIDIA SegFormer: uso no comercial. ~110 MB
    "segformer_b2_clothes.onnx": "https://huggingface.co/mattmdjaga/segformer_b2_clothes/resolve/main/onnx/model.onnx",
}

ONNX_SHA256 = {
    "face_parsing_resnet18.onnx": "0d9bd318e46987c3bdbfacae9e2c0f461cae1c6ac6ea6d43bbe541a91727e33f",
    "segformer_b2_clothes.onnx": "a93a8dac171b5c1fcc53632a8bfc180bfd9759ea69a3e207451bb07f76add54f",
}


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    target = args[0] if args else os.getenv("MODELS_DIR", "./models")
    os.makedirs(target, exist_ok=True)
    for name, url in MODELS.items():
        path = os.path.join(target, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            print(f"[ok] {name} ya existe")
            continue
        print(f"[descargando] {name}")
        urllib.request.urlretrieve(url, path)
    if "--with-onnx" in sys.argv:
        for name, url in ONNX_MODELS.items():
            path = os.path.join(target, name)
            if not (os.path.exists(path) and os.path.getsize(path) > 0):
                print(f"[descargando] {name}")
                urllib.request.urlretrieve(url, path)
            sha = ONNX_SHA256.get(name)
            if sha and _sha256(path) != sha:
                os.remove(path)
                raise SystemExit(f"[error] {name}: la suma SHA-256 no coincide; se borró el archivo.")
            print(f"[ok] {name}")
    if "--with-clip" in sys.argv:
        # HU-010: clasificador zero-shot de prendas (MobileCLIP2-S0, ~290 MB)
        os.environ["HF_HOME"] = os.path.join(target, "hf")
        import open_clip
        open_clip.create_model_and_transforms("MobileCLIP2-S0", pretrained="dfndr2b")
        print("[ok] MobileCLIP2-S0 descargado en", os.environ["HF_HOME"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
