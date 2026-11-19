# ==========================================
# Dockerfile para Servicio de IA (FastAPI, PyTorch, OpenCV)
# Cumple con Criterio de Aceptación 1 de HU-032
# ==========================================
FROM python:3.11-slim as base

# Evitar escritura de bytecode y habilitar buffer unbuffered
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Instalar dependencias del sistema necesarias para OpenCV headless y diagnóstico
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    libegl1 \
    libgles2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY app/ ./app/
COPY scripts/ ./scripts/
# Modelos MediaPipe (face, pose, segmentación, manos) descargados en la imagen
RUN mkdir -p /app/models && python scripts/download_models.py /app/models --with-clip --with-onnx
ENV MODELS_DIR=/app/models \
    HF_HOME=/app/models/hf \
    HF_HUB_OFFLINE=1

# Crear usuario de sistema no root para ejecución segura en ECS
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Exponer el puerto del microservicio
EXPOSE 8000

# Health check compatible con AWS ECS y Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando de arranque del servidor ASGI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
