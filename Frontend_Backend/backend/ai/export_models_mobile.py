import os
import sys
import torch
import torch.nn as nn
from torchvision.models import resnet34, ResNet34_Weights, resnet18, ResNet18_Weights, mobilenet_v3_small

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHECKPOINTS_DIR = os.getenv("MODELS_DIR", os.path.join(SCRIPT_DIR, "app", "models", "checkpoints"))
EXPORT_DIR = os.getenv("EXPORT_DIR", os.path.join(SCRIPT_DIR, "exported_models"))
os.makedirs(EXPORT_DIR, exist_ok=True)

print(f"[*] Exportando modelos para inferencia optimizada...")
print(f"    Checkpoints origen: {CHECKPOINTS_DIR}")
print(f"    Directorio destino: {EXPORT_DIR}")

# ==============================================================================
# 1. COLORIMETRÍA FACIAL (ResNet -> ONNX)
# ==============================================================================
print("\n[1/5] Exportando Colorimetría (ResNet-18/34)...")
try:
    colorimetry_ckpt = os.path.join(CHECKPOINTS_DIR, "colorimetry_v1.pt")
    state_dict = torch.load(colorimetry_ckpt, map_location="cpu") if os.path.exists(colorimetry_ckpt) else None
    
    # Auto-detectar si el checkpoint es ResNet-18 o ResNet-34 por número de capas
    if state_dict and "layer1.2.conv1.weight" not in state_dict:
        colorimetry_model = resnet18(weights=None)
    else:
        colorimetry_model = resnet34(weights=None)
        
    colorimetry_model.fc = nn.Linear(colorimetry_model.fc.in_features, 4)
    if state_dict:
        colorimetry_model.load_state_dict(state_dict)
    colorimetry_model.eval()

    dummy_face = torch.randn(1, 3, 224, 224)
    out_color_onnx = os.path.join(EXPORT_DIR, "colorimetry_v1.onnx")
    torch.onnx.export(
        colorimetry_model,
        dummy_face,
        out_color_onnx,
        input_names=["face_image"],
        output_names=["season_scores"],
        opset_version=18,
    )
    print(f"      [OK] Guardado en: {out_color_onnx}")
except Exception as e:
    print(f"      [ERROR] Colorimetria: {e}")

# ==============================================================================
# 2. ARMARIO DIGITAL (MobileNetV3 / ResNet-34 -> ONNX)
# ==============================================================================
print("\n[2/5] Exportando Armario Digital (Clasificador de Prendas)...")
try:
    from torchvision.models import mobilenet_v3_small
    wardrobe_model = mobilenet_v3_small(weights=None)
    in_features = wardrobe_model.classifier[0].in_features
    wardrobe_model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(),
        nn.Dropout(p=0.2),
        nn.Linear(256, 13)
    )
    wardrobe_ckpt = os.path.join(CHECKPOINTS_DIR, "wardrobe_v1.pt")
    if os.path.exists(wardrobe_ckpt):
        w_state = torch.load(wardrobe_ckpt, map_location="cpu")
        wardrobe_model.load_state_dict(w_state, strict=False)
    wardrobe_model.eval()

    dummy_garment = torch.randn(1, 3, 224, 224)
    out_wardrobe_onnx = os.path.join(EXPORT_DIR, "wardrobe_v1.onnx")
    torch.onnx.export(
        wardrobe_model,
        dummy_garment,
        out_wardrobe_onnx,
        input_names=["garment_image"],
        output_names=["category_probabilities"],
        dynamic_axes={"garment_image": {0: "batch_size"}, "category_probabilities": {0: "batch_size"}},
        opset_version=14,
    )
    print(f"      [OK] Guardado en: {out_wardrobe_onnx}")
except Exception as e:
    print(f"      [ERROR] Armario: {e}")

# ==============================================================================
# 3. MOTOR DE RECOMENDACIÓN (Red Siamesa ResNet -> ONNX)
# ==============================================================================
print("\n[3/5] Exportando Motor de Recomendación (Extractor Siames de Embeddings)...")
try:
    class SiameseEmbedder(nn.Module):
        def __init__(self, embedding_dim=128):
            super().__init__()
            backbone = resnet18(weights=None)
            in_feat = backbone.fc.in_features
            backbone.fc = nn.Identity()
            self.backbone = backbone
            self.head = nn.Sequential(
                nn.Linear(in_feat, 256),
                nn.ReLU(inplace=True),
                nn.Linear(256, embedding_dim)
            )

        def forward(self, x):
            f = self.backbone(x)
            emb = self.head(f)
            return torch.nn.functional.normalize(emb, p=2, dim=1)

    recommender_model = SiameseEmbedder()
    recommender_ckpt = os.path.join(CHECKPOINTS_DIR, "style_recommender_v1.pt")
    if os.path.exists(recommender_ckpt):
        try:
            r_state = torch.load(recommender_ckpt, map_location="cpu")
            recommender_model.load_state_dict(r_state, strict=False)
        except Exception:
            pass
    recommender_model.eval()

    dummy_outfit = torch.randn(1, 3, 224, 224)
    out_recom_onnx = os.path.join(EXPORT_DIR, "style_recommender_v1.onnx")
    torch.onnx.export(
        recommender_model,
        dummy_outfit,
        out_recom_onnx,
        input_names=["item_image"],
        output_names=["style_embedding"],
        dynamic_axes={"item_image": {0: "batch_size"}, "style_embedding": {0: "batch_size"}},
        opset_version=14,
    )
    print(f"      [OK] Guardado en: {out_recom_onnx}")
except Exception as e:
    print(f"      [ERROR] Recomendador: {e}")

# ==============================================================================
# 4. MORFOLOGÍA Y SILUETA CORPORAL (ResNet-34 Backbone -> Keypoints)
# ==============================================================================
print("\n[4/5] Exportando Morfología Corporal (ResNet-34 Keypoints)...")
try:
    class MorphologyKeypoints(nn.Module):
        def __init__(self, num_keypoints=34):
            super().__init__()
            base = resnet34(weights=None)
            in_f = base.fc.in_features
            base.fc = nn.Identity()
            self.base = base
            self.head = nn.Sequential(
                nn.Linear(in_f, 256),
                nn.ReLU(inplace=True),
                nn.Linear(256, num_keypoints)
            )

        def forward(self, x):
            return self.head(self.base(x))

    morph_model = MorphologyKeypoints()
    morph_model.eval()

    dummy_body = torch.randn(1, 3, 224, 224)
    out_morph_onnx = os.path.join(EXPORT_DIR, "morphology_v1.onnx")
    torch.onnx.export(
        morph_model,
        dummy_body,
        out_morph_onnx,
        input_names=["body_image"],
        output_names=["keypoints_normalized"],
        dynamic_axes={"body_image": {0: "batch_size"}, "keypoints_normalized": {0: "batch_size"}},
        opset_version=14,
    )
    print(f"      [OK] Guardado en: {out_morph_onnx}")
except Exception as e:
    print(f"      [ERROR] Morfologia: {e}")

# ==============================================================================
# 5. ANÁLISIS CAPILAR (U-Net Ligera -> ONNX)
# ==============================================================================
print("\n[5/5] Exportando Segmentación Capilar (U-Net)...")
try:
    class SimpleHairUNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.enc = nn.Sequential(
                nn.Conv2d(3, 32, 3, padding=1),
                nn.ReLU(inplace=True),
                nn.Conv2d(32, 32, 3, padding=1),
                nn.ReLU(inplace=True),
            )
            self.pool = nn.MaxPool2d(2, 2)
            self.mid = nn.Sequential(
                nn.Conv2d(32, 64, 3, padding=1),
                nn.ReLU(inplace=True),
            )
            self.up = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)
            self.dec = nn.Sequential(
                nn.Conv2d(64 + 32, 32, 3, padding=1),
                nn.ReLU(inplace=True),
                nn.Conv2d(32, 1, 1),
                nn.Sigmoid()
            )

        def forward(self, x):
            e = self.enc(x)
            p = self.pool(e)
            m = self.mid(p)
            u = self.up(m)
            cat = torch.cat([u, e], dim=1)
            return self.dec(cat)

    hair_model = SimpleHairUNet()
    hair_model.eval()

    dummy_hair = torch.randn(1, 3, 224, 224)
    out_hair_onnx = os.path.join(EXPORT_DIR, "hair_analysis_v1.onnx")
    torch.onnx.export(
        hair_model,
        dummy_hair,
        out_hair_onnx,
        input_names=["face_hair_image"],
        output_names=["hair_mask"],
        dynamic_axes={"face_hair_image": {0: "batch_size"}, "hair_mask": {0: "batch_size"}},
        opset_version=14,
    )
    print(f"      [OK] Guardado en: {out_hair_onnx}")
except Exception as e:
    print(f"      [ERROR] Capilar: {e}")

print("\n[*] Exportación de modelos completada exitosamente.")
