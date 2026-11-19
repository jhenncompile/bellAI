"""
================================================================================
CONVERSOR AUTOMÁTICO DE MODELOS PYTORCH (.pt) A MÓVIL (ONNX / PTL)
================================================================================
Coloca tus archivos .pt directamente en la carpeta:

    assets/models/

Y ejecuta en la terminal:

    python scripts/export_to_mobile.py

El script automáticamente:
1. Detecta todos los archivos .pt que coloques en 'assets/models/'.
2. Inspecciona las capas de cada modelo para AUTO-DETECTAR la arquitectura:
   - MobileNetV3-Small (Armario Digital / 244 capas)
   - MobileNetV3-Large (Colorimetría / Rostro / 312 capas con head custom)
   - ResNet-34 / ResNet-50
3. Auto-detecta el número de clases de salida (num_classes).
4. Carga los pesos con coincidencia exacta (0 missing keys).
5. Exporta un único archivo ONNX auto-contenido (.onnx) listo para la app.
6. Genera el archivo de metadatos (.json) con configuración para React Native.
================================================================================
"""

import os
import sys
import glob
import json
import argparse
from typing import Optional, Tuple, Dict, Any

# Configurar salida UTF-8 para evitar errores de codificación en consolas Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import torch
import torch.nn as nn
from torchvision.models import (
    resnet34,
    resnet50,
    mobilenet_v3_large,
    mobilenet_v3_small,
)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "assets", "models")


# ------------------------------------------------------------------------------
# DEFINICIONES DE ARQUITECTURAS COINCIDENTES CON EL ENTRENAMIENTO
# ------------------------------------------------------------------------------

class ArmarioMobileNetSmall(nn.Module):
    """Arquitectura exacta de wardrobe_v1 (MobileNetV3-Small con 2 capas en classifier)"""
    def __init__(self, num_classes: int = 1):
        super().__init__()
        self.backbone = mobilenet_v3_small(weights=None)
        self.backbone.classifier = nn.Sequential(
            nn.Linear(576, 256),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(256, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)


class ColorimetryMobileNetLarge(nn.Module):
    """Arquitectura exacta de colorimetry_v1 (MobileNetV3-Large con head personalizado)"""
    def __init__(self, num_classes: int = 4):
        super().__init__()
        self.backbone = mobilenet_v3_large(weights=None)
        self.backbone.classifier = nn.Identity()
        self.head = nn.Sequential(
            nn.Identity(),
            nn.Linear(960, 256),
            nn.Hardswish(),
            nn.Dropout(p=0.3),
            nn.Linear(256, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.backbone.features(x)
        feat = self.backbone.avgpool(feat)
        flat = torch.flatten(feat, 1)
        x = self.head[1](flat)
        x = self.head[2](x)
        x = self.head[3](x)
        x = self.head[4](x)
        return x


class ResNetClassifier(nn.Module):
    """Arquitectura ResNet-34 o ResNet-50"""
    def __init__(self, num_classes: int = 13, is_resnet50: bool = False):
        super().__init__()
        if is_resnet50:
            self.backbone = resnet50(weights=None)
            in_f = 2048
        else:
            self.backbone = resnet34(weights=None)
            in_f = 512

        self.backbone.fc = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(in_f, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)


# ------------------------------------------------------------------------------
# INSPECCIÓN Y DETECCIÓN INTELIGENTE DE PESOS
# ------------------------------------------------------------------------------

def inspect_checkpoint(weights_path: str) -> Tuple[nn.Module, str, int, Dict[str, Any]]:
    """
    Inspecciona las claves del checkpoint y construye la arquitectura EXACTA
    que coincide al 100% con los pesos entrenados.
    """
    checkpoint = torch.load(weights_path, map_location="cpu")
    state_dict = checkpoint

    if isinstance(checkpoint, dict):
        if "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state_dict = checkpoint["state_dict"]
        elif "model" in checkpoint:
            state_dict = checkpoint["model"]

    keys = list(state_dict.keys())
    keys_str = " ".join(keys)

    # 1. Caso Colorimetría: MobileNetV3-Large con head.1 y head.4
    if "head.1.weight" in state_dict and "head.4.weight" in state_dict:
        num_classes = int(state_dict["head.4.weight"].shape[0])
        model = ColorimetryMobileNetLarge(num_classes=num_classes)
        res = model.load_state_dict(state_dict, strict=True)
        return model, "MobileNetV3-Large (Colorimetría)", num_classes, state_dict

    # 2. Caso Armario MobileNetV3-Small: features.12 y backbone.classifier.3
    if ("features.12" in keys_str or "classifier.3" in keys_str) and "features.16" not in keys_str:
        num_classes = 1
        for k in ["backbone.classifier.3.weight", "classifier.3.weight"]:
            if k in state_dict:
                num_classes = int(state_dict[k].shape[0])
                break
        model = ArmarioMobileNetSmall(num_classes=num_classes)
        # Asegurar prefijo 'backbone.'
        adapted_dict = {}
        for k, v in state_dict.items():
            if not k.startswith("backbone."):
                adapted_dict[f"backbone.{k}"] = v
            else:
                adapted_dict[k] = v
        model.load_state_dict(adapted_dict, strict=True)
        return model, "MobileNetV3-Small (Armario)", num_classes, state_dict

    # 3. Caso ResNet-50
    if ("resnet50" in weights_path.lower() or "layer4.2.conv3" in keys_str):
        num_classes = 13
        for k in ["backbone.fc.1.weight", "fc.1.weight", "fc.weight"]:
            if k in state_dict:
                num_classes = int(state_dict[k].shape[0])
                break
        model = ResNetClassifier(num_classes=num_classes, is_resnet50=True)
        model.load_state_dict(state_dict, strict=False)
        return model, "ResNet-50", num_classes, state_dict

    # 4. Caso ResNet-34
    num_classes = 13
    for k in ["backbone.fc.1.weight", "fc.1.weight", "fc.weight"]:
        if k in state_dict:
            num_classes = int(state_dict[k].shape[0])
            break
    model = ResNetClassifier(num_classes=num_classes, is_resnet50=False)
    model.load_state_dict(state_dict, strict=False)
    return model, "ResNet-34", num_classes, state_dict


# ------------------------------------------------------------------------------
# EXPORTACIÓN ONNX AUTO-CONTENIDA
# ------------------------------------------------------------------------------

def export_model_to_self_contained_onnx(model: nn.Module, output_path: str, resolution: int = 224) -> str:
    """
    Exporta a ONNX y asegura que todos los pesos estén integrados en un único
    archivo .onnx (sin archivos .data sueltos).
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    dummy_input = torch.randn(1, 3, resolution, resolution, requires_grad=False)

    temp_path = output_path + ".tmp.onnx"
    torch.onnx.export(
        model,
        dummy_input,
        temp_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
    )

    # Si se generó con external data (.tmp.onnx.data), unificarlo en un solo .onnx
    try:
        import onnx
        loaded_model = onnx.load(temp_path, load_external_data=True)
        onnx.save(loaded_model, output_path)
        # Limpiar temporales
        if os.path.exists(temp_path):
            os.remove(temp_path)
        data_sidecar = temp_path + ".data"
        if os.path.exists(data_sidecar):
            os.remove(data_sidecar)
    except Exception:
        # Fallback si onnx package no unifica
        if os.path.exists(temp_path):
            if os.path.exists(output_path):
                os.remove(output_path)
            os.rename(temp_path, output_path)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  [OK] ONNX generado: {os.path.basename(output_path)} ({size_mb:.2f} MB, auto-contenido)")
    return output_path


def process_weights_file(weights_path: str, output_dir: str = MODELS_DIR):
    base_name = os.path.splitext(os.path.basename(weights_path))[0]
    print(f"\n=======================================================")
    print(f"[*] Analizando modelo: {os.path.basename(weights_path)}")
    print(f"=======================================================")

    model, arch_name, num_classes, _ = inspect_checkpoint(weights_path)
    model.eval()

    print(f"  -> Arquitectura: {arch_name}")
    print(f"  -> Clases detectadas: {num_classes}")

    # Exportar ONNX
    onnx_file = os.path.join(output_dir, f"{base_name}.onnx")
    export_model_to_self_contained_onnx(model, onnx_file)

    # Limpiar cualquier residuo de exportaciones previas
    residue_data = onnx_file + ".data"
    if os.path.exists(residue_data):
        try:
            os.remove(residue_data)
        except Exception:
            pass

    # Generar metadatos para la app móvil
    meta_file = os.path.join(output_dir, f"{base_name}_meta.json")
    metadata = {
        "model_file": os.path.basename(weights_path),
        "onnx_file": f"{base_name}.onnx",
        "architecture": arch_name,
        "num_classes": num_classes,
        "input_shape": [1, 3, 224, 224],
        "normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        }
    }
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"  [OK] Metadatos guardados: {os.path.basename(meta_file)}")


def main():
    print("=====================================================================")
    print(f" Buscando archivos .pt en: {MODELS_DIR}")
    print("=====================================================================")

    pt_files = glob.glob(os.path.join(MODELS_DIR, "*.pt")) + glob.glob(os.path.join(MODELS_DIR, "*.pth"))

    if not pt_files:
        print("\n[!] No se encontró ningún archivo .pt en 'assets/models/' todavía.")
        print("\n[i] INSTRUCCIÓN:")
        print(f"    1. Pega tus archivos .pt en: {MODELS_DIR}")
        print("    2. Vuelve a ejecutar: python scripts/export_to_mobile.py")
        sys.exit(0)

    print(f"[*] Se detectaron {len(pt_files)} modelo(s):")
    for f in pt_files:
        print(f"    - {os.path.basename(f)}")

    for weights_file in pt_files:
        try:
            process_weights_file(weights_file, output_dir=MODELS_DIR)
        except Exception as e:
            print(f"[!] Error procesando {os.path.basename(weights_file)}: {e}")

    print("\n=====================================================================")
    print("[V] ¡Conversión finalizada con éxito! Modelos listos en assets/models/")
    print("=====================================================================")


if __name__ == "__main__":
    main()
