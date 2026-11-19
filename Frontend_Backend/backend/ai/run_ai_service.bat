@echo off
rem Sin parentesis en title/echo: cmd los interpreta como bloques y rompe el script.
title BellAI - Microservicio de IA - puerto 8001
cd /d "%~dp0"

rem Se usa el entorno virtual del proyecto (Python 3.12). El python del sistema no tiene
rem mediapipe, torch ni onnxruntime, y mediapipe no publica ruedas para Python 3.14.
set "PY=%~dp0.venv\Scripts\python.exe"
if not exist "%PY%" (
  echo No existe el entorno virtual .venv. Crealo una vez con:
  echo   py -3.12 -m venv .venv
  echo   .venv\Scripts\python -m pip install -r requirements.txt
  pause
  exit /b 1
)

rem Descarga solo los modelos que falten: MediaPipe, CLIP y ONNX BiSeNet/SegFormer.
"%PY%" scripts\download_models.py models --with-clip --with-onnx
if errorlevel 1 echo Aviso: no se pudieron descargar todos los modelos; las funciones que los usan responderan 503.

echo =====================================================================
echo  Microservicio de IA en http://localhost:8001  -  docs: /docs
echo  ResNet-34, MediaPipe, CLIP, BiSeNet face parsing y SegFormer-B2
echo =====================================================================
"%PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
pause
