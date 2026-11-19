import os

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def _bytes(name):
    with open(os.path.join(FIX, name), "rb") as f:
        return f.read()


def test_api_vision_prediction_success(client):
    """/vision/predict ejecuta ResNet-34 y devuelve clases de ImageNet."""
    response = client.post("/api/v1/vision/predict", files={"file": ("x.jpg", _bytes("prenda_gabardina.jpg"), "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["model_type"] == "resnet34_imagenet"
    assert data["predicted_class"] == "trench coat"


def test_api_vision_analyze_garment_devuelve_metodo_y_vector(client):
    """Antes el response_model descartaba method/alternatives: ahora llegan a NestJS."""
    response = client.post("/api/v1/vision/analyze-garment", files={"file": ("foto.jpg", _bytes("prenda_jeans.jpg"), "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["subcategory"] == "jeans"
    assert data["category"] == "inferior"
    assert data["method"].startswith("resnet34_imagenet")
    assert "alternatives" in data
    assert len(data["feature_vector"]) == 512
    assert data["color_hex"].startswith("#")


def test_api_vision_invalid_file_type(client):
    response = client.post("/api/v1/vision/predict", files={"file": ("documento.txt", b"no es imagen", "text/plain")})
    assert response.status_code == 400
    assert "Formato de archivo inválido" in response.json()["detail"]


def test_api_vision_imagen_corrupta(client):
    response = client.post("/api/v1/vision/predict", files={"file": ("x.jpg", b"no es un jpg", "image/jpeg")})
    assert response.status_code == 422


def test_api_compatibilidad_siamesa(client):
    response = client.post(
        "/api/v1/recommendations/match-compatibility",
        files={
            "garment_a": ("a.jpg", _bytes("prenda_jeans.jpg"), "image/jpeg"),
            "garment_b": ("b.jpg", _bytes("prenda_gabardina.jpg"), "image/jpeg"),
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model_type"] == "siamese_resnet34"
    assert 0 <= data["compatibilityScore"] <= 100


def test_api_rank(client):
    v = [0.1] * 512
    response = client.post("/api/v1/recommendations/rank", json={"anchor": v, "candidates": {"a": v}})
    assert response.status_code == 200
    assert response.json()["results"][0]["itemId"] == "a"


def test_health_informa_resnet(client):
    assert client.get("/health").json()["models"]["resnet34_imagenet"] is True
