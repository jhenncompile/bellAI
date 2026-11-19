# Servicio de IA de BellAI (FastAPI)

Analizadores intercambiables (HU-043) que usa el backend NestJS a través de `AiGatewayService`.
Documentación interactiva en `http://localhost:8001/docs`.

## Arranque local

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python scripts/download_models.py models --with-clip --with-onnx   # MediaPipe + MobileCLIP2-S0 + face parsing y SegFormer (~500 MB)
.venv/bin/uvicorn app.main:app --port 8001
GARMENT_CLIP_WARMUP=0 .venv/bin/pytest --cov=app                  # ≥ 80 % de cobertura
```

Si se define `AI_INTERNAL_KEY`, todas las rutas `/api/v1/*` exigen la cabecera `X-Internal-Key`.

## Analizadores (`app/analyzers/`)

| Analizador | Archivo | Historias | Técnica |
|---|---|---|---|
| Calidad de foto | `quality.py` | HU-035 | Brillo, sobreexposición, contraste, nitidez (laplaciano), rostro único, distancia, giro, inclinación, luz lateral; cuerpo completo, postura, de frente, brazos separados. Umbrales configurables. |
| Rostro | `face.py` | HU-002 | Face Landmarker (478 puntos) → proporciones → forma por prototipos con confianza; recomendaciones de cortes, gafas, escotes. |
| Colorimetría y cabello | `color.py`, `palettes.py` | HU-004, HU-006 | Gray world + segmentación selfie_multiclass → CIELAB de piel, iris y cabello → subtono, contraste, 12 estaciones y paleta; lectura visual del cabello. |
| Cuerpo | `body.py` | HU-003 | Pose Landmarker + máscara de persona → hombros, cintura, cadera, verticalidad → silueta sin juicios de valor. SegFormer-B2 descuenta los brazos pegados a los costados al medir cintura y cadera (`parameters.widthsSource`). |
| Prendas | `garment.py`, `garment_color.py` | HU-010, HU-015, HU-024 | Recorte con SegFormer (si la lleva una persona), magic_touch o GrabCut; color con luz corregida, k-means por tono, CIEDE2000 y CLIP; MobileCLIP2-S0 zero-shot (subcategoría, estampado, estilo, ocasión) o heurística sin pesos. |
| Simulaciones | `simulation.py` | HU-019–021 | Recolor de cabello (completo, balayage, mechas), labial/rubor/sombra, uñas (Hand Landmarker), gafas dibujadas sobre los ojos. |
| Registro | `registry.py` | HU-032, HU-043 | Nombre, versión, modelos requeridos y comprobación de compatibilidad. |

## Qué modelo ejecuta cada función (verificado)

| Función | Modelo que corre de verdad | Archivo |
|---|---|---|
| Armario (tipo de prenda) | **ResNet-34** con pesos de ImageNet (`checkpoints/resnet34_pretrained.pt`): se suman las probabilidades de las clases de ropa de ImageNet (jean, miniskirt, trench coat, running shoe…) promediando dos vistas de la foto; se combina con **CLIP MobileCLIP2-S0** (4 plantillas por prenda: catálogo, puesta, en percha, primer plano) y, si la prenda la lleva una persona, con la clase de **SegFormer** (arriba / falda / pantalón / vestido). Producto de expertos con ResNet a peso 0,5: con 14 fotos reales pasa de 12/14 a 14/14 aciertos. `confidence` es la probabilidad combinada, o `null` si ningún modelo reconoce la prenda. | `models/garment_fusion.py`, `models/resnet_garment.py`, `models/vision.py` |
| Recorte de prendas | Si la prenda la lleva una persona (MediaPipe Pose o SegFormer la detectan), **SegFormer-B2** la separa de piel, cabello y otras prendas; si no, MediaPipe Interactive Segmenter (`magic_touch.tflite`) señalando el centro de la foto; GrabCut si falta el modelo. Mide el color sobre la tela, no sobre el fondo o la etiqueta. | `analyzers/garment.py` |
| Color de prendas | 1) Balance de blancos: comité (mediana) de píxeles grises (Yang et al., CVPR 2015), Shades-of-Gray y Gray-Edge, aplicado en espacio lineal. 2) k-means por tono sobre la foto difuminada ~0,6 % (el jaspeado se ve como un color) midiendo con los píxeles originales. 3) Nombre por **CIEDE2000** entre 40 colores de moda. 4) **CLIP** puntúa los mismos 40 colores sobre la prenda recortada y se combina con la medida (`color_confidence`, `color_alternatives`). El hex es siempre el medido. Evaluación con 9 fotos reales × 3 luces: 23-24/27 aciertos (antes 9/27). La app usa la misma paleta y CIEDE2000 sin conexión (`Movil/src/shared/lib/garmentColor.ts`). | `analyzers/garment_color.py` |
| Recomendador | **Red siamesa**: el mismo ResNet-34 (pesos compartidos) convierte cada prenda en un vector de 512 dimensiones; similitud coseno + armonía de color, devueltas por separado. | `models/recommendation.py` |
| Colorimetría | MediaPipe Face Landmarker + **BiSeNet face parsing (ResNet-18, CelebAMask-HQ, 19 clases)** → piel, cabello e iris medidos en CIELAB sobre sus píxeles; detecta gafas y sombrero. Sin el ONNX se usa el segmentador multiclase de MediaPipe. | `analyzers/color.py`, `analyzers/onnx_models.py` |
| Morfología | MediaPipe Pose Landmarker `full` (33 puntos clave; `lite` como respaldo) + máscara de persona. | `analyzers/body.py` |
| Cabello | BiSeNet face parsing (separa cabello de sombrero y gafas) + MediaPipe para el cabello largo fuera del recorte del rostro. También lo usa la simulación de color (HU-019). | `analyzers/color.py`, `analyzers/simulation.py` |
| Rasgos para maquillaje | Geometría sobre los 478 puntos de MediaPipe: inclinación de los ojos (corregida con la de la cabeza), separación, apertura y volumen de labios, con consejos de delineado, sombra y labial (`face.features`). Umbrales relativos a la mediana de 22 rostros; `reliable` es falso con la cara girada. | `analyzers/face.py` |
| Textura del cabello | **CLIP** zero-shot (liso, ondulado, rizado, afro) combinando la cabeza completa (0,7) y el cabello recortado (0,3): 11/14 con fotos reales de Wikimedia Commons; los fallos son entre tipos vecinos. Devuelve probabilidad y `uncertain` por debajo de 0,5. | `analyzers/color.py` |
| Evaluar compra (HU-24) | La foto de la tienda pasa por `analyze-garment`; avisa si el armario ya tiene una prenda del mismo tipo y color (CIEDE2000 < 10) y detecta duplicados con el vector visual (coseno ≥ 0,9, que se guarda al registrar cada prenda). | backend `store-garment-evaluator.service.ts` |
| Ropa puesta | **SegFormer-B2 entrenado en ATR** (prenda superior, falda, pantalón, vestido, calzado, bolso…) y color de cada prenda. `POST /api/v1/vision/analyze-outfit`. Licencia NVIDIA SegFormer: uso no comercial. | `analyzers/onnx_models.py`, `models/vision.py` |
| Probador | Prenda ajustada a hombros/caderas con MediaPipe Pose (vista 2D aproximada). | `analyzers/simulation.py` |
| Maquillaje | Labial, rubor y sombra sobre los puntos del rostro (MediaPipe). | `analyzers/simulation.py` |

**Mismo modelo en el teléfono.** `face_parsing_resnet18.onnx` también corre en la app móvil con
`onnxruntime-react-native` (`Movil/src/shared/ai/faceParsingModel.ts`) para el análisis sin conexión.
Se descartó U²-Net (`u2netp`): en primeros planos de prendas recorta las etiquetas en vez de la prenda.

**Lo que no está y por qué.** En `checkpoints/` solo `resnet34_pretrained.pt` sirve: `unet_pretrained.pt` es el U-Net de
segmentación de tumores cerebrales (mateuszbuda/brain-segmentation-pytorch), y `colorimetry_v1.pt`, `wardrobe_v1.pt` y
`style_recommender_v1.pt` tienen la capa de salida sin entrenar. Ningún código los carga. No hay VITON-HD ni BeautyGAN:
VITON-HD necesita DensePose, parsing humano y GPU, y BeautyGAN es TensorFlow 1. Una colorimetría o unos puntos clave
con ResNet-34 requerirían un conjunto de datos etiquetado para entrenarlos, que el proyecto no tiene.

## Endpoints

| Ruta | Uso |
|---|---|
| `POST /api/v1/analysis/validate` | Validar una foto (`type` = rostro, cuerpo o prenda; `thresholds` JSON opcional) |
| `POST /api/v1/analysis/face` | Validación + rostro + colorimetría + cabello |
| `POST /api/v1/analysis/body` | Validación + proporciones corporales |
| `POST /api/v1/analysis/colorimetry` | Solo colorimetría |
| `POST /api/v1/analysis/garment` | Clasificación rápida de prenda |
| `POST /api/v1/vision/analyze-garment` | Tipo (ResNet-34 + CLIP), color, vector de 512 dimensiones e imagen de estudio (armario) |
| `POST /api/v1/vision/predict` | Las 5 clases de ImageNet más probables (ResNet-34) |
| `POST /api/v1/vision/{analyze-face,analyze-hair,analyze-body,virtual-tryon,virtual-makeup}` | Rostro, cabello, cuerpo, probador y maquillaje (MediaPipe) |
| `POST /api/v1/recommendations/match-compatibility` | Compatibilidad de dos fotos de prendas (red siamesa) |
| `POST /api/v1/recommendations/{embed,rank}` | Vector de una prenda / ranking por vectores ya calculados |
| `POST /api/v1/simulate/{color_cabello,maquillaje,unas,gafas}` | Simulación; devuelve la imagen en base64 |
| `GET /api/v1/models`, `GET /api/v1/models/{name}/check` | Registro y comprobación de analizadores |
| `GET /health` | Estado y modelos disponibles (incluye `resnet34_imagenet`) |

Una foto que no cumple las condiciones responde **422** con `{"code": "foto_invalida", "quality": {...}}` y no se analiza.

---

# 🤖 [TEC-15] Microservicio de Modelos de IA & Pipeline CI/CD

Este módulo implementa la solución para la tarea técnica **[TEC-15] Pipeline CI/CD del servicio de IA (pruebas, ECR y ECS)** (anteriormente referenciada como **[HU-032] Configurar pipeline CI/CD para modelos de IA**, vinculada a **HU-30 · RNF-07 Mantenibilidad**), proporcionando un microservicio desacoplado en Python para inferencia de modelos y su pipeline automatizado en GitHub Actions hacia AWS ECR y ECS apuntando a cuentas AWS reales.

---

## 🎯 Cobertura de Criterios de Aceptación (TEC-15 / HU-032)

| Criterio de Aceptación | Implementación |
|---|---|
| **1. Empaquetado automático en Docker (FastAPI, PyTorch, OpenCV)** | [`backend/ai/Dockerfile`](file:///c:/Users/ldgd2/Documents/universidad/software%201/sem%202-2026/Proyecto/Frontend_Backend/backend/ai/Dockerfile) optimizado para Python 3.11-slim, librerías de OpenCV y PyTorch, con usuario no root y healthchecks integrados. |
| **2. Pruebas automatizadas con pytest previas a la aprobación** | Suite en [`backend/ai/tests/`](file:///c:/Users/ldgd2/Documents/universidad/software%201/sem%202-2026/Proyecto/Frontend_Backend/backend/ai/tests) ejecutada automáticamente en el job `test-and-validate-models` del pipeline, requiriendo cobertura mínima del 80%. |
| **3. Despliegue transparente en AWS ECS sin interrupciones (Zero-Downtime)** | Despliegue en AWS ECS mediante rolling update con `wait-for-service-stability: true` en el job `deploy-to-ecs-zero-downtime`, garantizando disponibilidad >= 99%. |
| **4. Desacoplamiento modular de Frontend y Base de Datos** | La API de IA se comunica exclusivamente mediante contratos REST HTTP (`/api/v1/vision/*`, `/api/v1/recommendations/*`), permitiendo sustituir o actualizar modelos sin tocar la base de datos o el frontend. |
| **5. Regla de Pull Requests y Peer Review** | El workflow se ejecuta en cada Pull Request a `main` y `develop`. La integración de nuevos modelos está sujeta a revisión cruzada y aprobación de tests. |

---

## 📁 Estructura del Módulo

```
backend/ai/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/
│   │   │   ├── vision.py           # Inferencia de Visión con OpenCV y PyTorch
│   │   │   └── recommendation.py   # Inferencia de Recomendaciones
│   │   └── router.py               # Enrutador v1 de IA
│   ├── core/
│   │   └── config.py               # Configuraciones Pydantic
│   ├── models/
│   │   ├── vision.py               # Preprocesamiento de imagen y Red CNN PyTorch
│   │   └── recommendation.py       # Modelo de embeddings de recomendación
│   └── main.py                     # App FastAPI con /health y Swagger docs
├── aws/
│   └── task-definition.json        # Plantilla oficial de Amazon ECS Task Definition
├── tests/
│   ├── conftest.py                 # Fixtures y generación de imágenes sintéticas
│   ├── test_health.py              # Prueba del endpoint /health
│   ├── test_vision_model.py        # Pruebas unitarias de PyTorch y OpenCV
│   ├── test_recommendation_model.py# Pruebas del motor de recomendación
│   └── test_api_endpoints.py       # Pruebas de integración HTTP
├── .dockerignore
├── Dockerfile                      # Empaquetado de producción
├── requirements.txt                # Dependencias base
└── requirements-dev.txt            # Dependencias para pruebas (pytest, coverage)
```

---

## 🔄 Flujo del Pipeline CI/CD (`.github/workflows/ai-models-ci-cd.yml`)

```
                  ┌─────────────────────────────┐
                  │    Pull Request en GitHub    │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │   FASE 1: Test & Lint       │
                  │   - Flake8 Linter           │
                  │   - pytest (Modelos & API)  │
                  │   - Validación de Cobertura │
                  └──────────────┬──────────────┘
                                 │ (Aprobado + Merge a main)
                                 ▼
                  ┌─────────────────────────────┐
                  │   FASE 2: Build & Push ECR   │
                  │   - Docker build            │
                  │   - Push a Amazon ECR       │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │   FASE 3: Deploy AWS ECS    │
                  │   - Actualizar Task Def     │
                  │   - Rolling update en ECS   │
                  │   - Zero-Downtime verificado│
                  └─────────────────────────────┘
```

---

## 🔐 Configuración de Secrets en GitHub Repository

Para habilitar el despliegue automático hacia AWS, configura los siguientes Secrets en `Settings > Secrets and variables > Actions`:

| Secret Name | Obligatorio | Descripción | Ejemplo / Valor por defecto |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | Sí | Clave de acceso IAM con permisos para ECR y ECS | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Sí | Clave secreta IAM | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | No | Región de AWS donde opera el cluster y CloudWatch | `us-east-1` (por defecto) |
| `AWS_ACCOUNT_ID` | No | ID de cuenta de AWS de 12 dígitos. Si no se define, el pipeline lo autodetecta con `aws sts get-caller-identity` | `987654321098` |
| `ECR_REPOSITORY` | No | Nombre del repositorio en Amazon ECR | `aura-ai-models` (por defecto) |
| `ECS_CLUSTER` | No | Nombre del cluster de Amazon ECS | `aura-cluster` (por defecto) |
| `ECS_SERVICE` | No | Nombre del servicio ECS | `aura-ai-service` (por defecto) |
| `ECS_EXECUTION_ROLE_ARN` | No | ARN del rol IAM de ejecución ECS. Si no se define, usa `arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole` | `arn:aws:iam::123456789012:role/miRolEjecucion` |
| `ECS_TASK_ROLE_ARN` | No | ARN del rol IAM de la tarea ECS. Si no se define, usa `arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskRole` | `arn:aws:iam::123456789012:role/miRolTarea` |

> [!NOTE]
> La plantilla `backend/ai/aws/task-definition.json` utiliza placeholders parametrizados (`<AWS_ACCOUNT_ID>` y `<AWS_REGION>`). Durante la fase de despliegue en GitHub Actions, el pipeline inyecta dinámicamente la cuenta real y la región antes del renderizado de la imagen y el rolling update sin tiempo de inactividad.

---

## 🧪 Cómo Ejecutar las Pruebas Localmente

1. Crear un entorno virtual de Python:
   ```bash
   cd backend/ai
   python -m venv venv
   # En Windows:
   .\venv\Scripts\activate
   # En Linux/macOS:
   source venv/bin/activate
   ```

2. Instalar dependencias de desarrollo:
   ```bash
   pip install -r requirements-dev.txt
   ```

3. Ejecutar la suite de pruebas automatizadas con pytest:
   ```bash
   pytest tests -v --cov=app --cov-report=term-missing
   ```

4. Ejecutar el servidor en desarrollo:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   * Documentación Swagger interactiva: [http://localhost:8000/docs](http://localhost:8000/docs)
