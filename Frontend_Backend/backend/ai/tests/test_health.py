def test_health_check_endpoint(client):
    """Verifica que el healthcheck responda 200 y reporte estado healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_cors_allowed_origin(client):
    """Verifica que un origen permitido reciba cabeceras CORS (TEC-06)."""
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_disallowed_origin(client):
    """Verifica que un origen no permitido no reciba cabecera access-control-allow-origin (TEC-06)."""
    response = client.get("/health", headers={"Origin": "http://sitio-malicioso.com"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
