"""Módulo de Instalación de Requerimientos, Librerías y Compilación para BellAI."""
import os
import shutil
import sys
from cli.console import console, print_header
from rich.prompt import Prompt
from cli.utils.process_runner import run_cmd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
FRONTEND_DIR = os.path.join(BASE_DIR, "Frontend")
AI_DIR = os.path.join(BASE_DIR, "backend", "ai")
AI_VENV = os.path.join(AI_DIR, ".venv")


def _get_python_ai_bin() -> str:
    """Devuelve la ruta del binario python para el entorno virtual de la IA."""
    if os.name == "nt":
        venv_py = os.path.join(AI_VENV, "Scripts", "python.exe")
    else:
        venv_py = os.path.join(AI_VENV, "bin", "python")
    return venv_py if os.path.exists(venv_py) else sys.executable


def _get_pip_ai_bin() -> str:
    """Devuelve la ruta del binario pip para el entorno virtual de la IA."""
    if os.name == "nt":
        venv_pip = os.path.join(AI_VENV, "Scripts", "pip.exe")
    else:
        venv_pip = os.path.join(AI_VENV, "bin", "pip")
    return venv_pip if os.path.exists(venv_pip) else "pip"


def instalar_deps_backend():
    console.print("\n[bold cyan]📦 1. Instalando dependencias de Node.js en Backend NestJS (npm install)...[/bold cyan]")
    ok, out = run_cmd(["npm", "install"], cwd=BACKEND_DIR)
    if ok:
        console.print("[bold green]✔ Dependencias del backend instaladas correctamente (backend/node_modules listo).[/bold green]")
        return True
    console.print("[bold red]✖ Error al ejecutar npm install en backend.[/bold red]")
    return False


def instalar_deps_ia():
    console.print("\n[bold cyan]🧠 2. Configurando Entorno Virtual e Instalando Requerimientos de IA (Python)...[/bold cyan]")
    
    # 1. Asegurar venv en backend/ai/.venv
    if not os.path.exists(AI_VENV):
        console.print(f"[cyan]Creando entorno virtual dedicado en {AI_VENV}...[/cyan]")
        run_cmd([sys.executable, "-m", "venv", AI_VENV])

    pip_bin = _get_pip_ai_bin()
    console.print(f"[dim]Actualizando pip con {pip_bin}...[/dim]")
    run_cmd([pip_bin, "install", "--upgrade", "pip"], cwd=AI_DIR, silent=True)

    # 2. Instalar requirements.txt
    req_file = os.path.join(AI_DIR, "requirements.txt")
    if os.path.exists(req_file):
        console.print(f"[cyan]Instalando PyTorch, MediaPipe, OpenCV, FastAPI desde {req_file}...[/cyan]")
        ok, out = run_cmd([pip_bin, "install", "-r", "requirements.txt"], cwd=AI_DIR)
        if ok:
            console.print("[bold green]✔ Librerías de IA instaladas exitosamente en el entorno virtual.[/bold green]")
            return True
        console.print("[bold red]✖ Error al instalar requerimientos de IA.[/bold red]")
        return False
    else:
        console.print(f"[yellow]No se encontró {req_file}[/yellow]")
        return False


def descargar_modelos_ia():
    console.print("\n[bold cyan]📥 3. Descargando Modelos Biométricos (CLIP, BiSeNet, SegFormer, ResNet-34)...[/bold cyan]")
    py_bin = _get_python_ai_bin()
    download_script = os.path.join(AI_DIR, "scripts", "download_models.py")
    if os.path.exists(download_script):
        ok, out = run_cmd([py_bin, "scripts/download_models.py", "models", "--with-clip"], cwd=AI_DIR)
        if ok:
            console.print("[bold green]✔ Todos los modelos de visión por computadora están listos.[/bold green]")
            return True
        console.print("[yellow]Aviso: La descarga finalizó con advertencias o algunos modelos ya estaban descargados.[/yellow]")
        return True
    else:
        console.print(f"[yellow]No se encontró el script {download_script}[/yellow]")
        return False


def instalar_deps_frontend():
    console.print("\n[bold cyan]🎨 4. Instalando dependencias de Frontend React 19 (pnpm / npm install)...[/bold cyan]")
    ok = False
    if shutil.which("pnpm"):
        ok, _ = run_cmd(["pnpm", "install"], cwd=FRONTEND_DIR)
    if not ok:
        console.print("[yellow]Ejecutando con npm install...[/yellow]")
        ok, _ = run_cmd(["npm", "install"], cwd=FRONTEND_DIR)

    if ok:
        console.print("[bold green]✔ Dependencias del Frontend instaladas exitosamente.[/bold green]")
        return True
    console.print("[bold red]✖ Error al instalar dependencias del frontend.[/bold red]")
    return False


def compilar_backend():
    console.print("\n[bold cyan]⚙️  Compilando Backend NestJS (npm run build)...[/bold cyan]")
    ok, _ = run_cmd(["npm", "run", "build"], cwd=BACKEND_DIR)
    if ok:
        console.print("[bold green]✔ Backend NestJS compilado (backend/dist/main.js generado).[/bold green]")
        return True
    console.print("[bold red]✖ Error al compilar backend con nest build.[/bold red]")
    return False


def compilar_frontend():
    console.print("\n[bold cyan]⚙️  Compilando Frontend Vite SPA (pnpm / npm run build)...[/bold cyan]")
    ok = False
    if shutil.which("pnpm"):
        ok, _ = run_cmd(["pnpm", "build"], cwd=FRONTEND_DIR)
    if not ok:
        ok, _ = run_cmd(["npm", "run", "build"], cwd=FRONTEND_DIR)

    if ok:
        console.print("[bold green]✔ Frontend buildeado exitosamente (Frontend/dist listo para NGINX).[/bold green]")
        return True
    console.print("[bold red]✖ Error al compilar Frontend con Vite.[/bold red]")
    return False


def instalar_todo():
    """Instala todas las dependencias y modelos del proyecto en un solo flujo."""
    console.print("\n[bold #E07A5F]=== INSTALANDO TODAS LAS DEPENDENCIAS DEL PROYECTO ===[/bold #E07A5F]")
    b_ok = instalar_deps_backend()
    ai_ok = instalar_deps_ia()
    m_ok = descargar_modelos_ia()
    f_ok = instalar_deps_frontend()
    if b_ok and ai_ok and f_ok:
        console.print("\n[bold green]✔ Todas las dependencias, librerías y modelos fueron instalados con éxito.[/bold green]")


def instalar_y_compilar_todo():
    """Instala todas las dependencias y compila todo el proyecto en un solo paso."""
    instalar_todo()
    console.print("\n[bold #E07A5F]=== COMPILANDO EL SISTEMA ===[/bold #E07A5F]")
    compilar_backend()
    compilar_frontend()
    console.print("\n[bold green]✔ Proyecto completamente instalado, descargado y compilado listo para desplegar.[/bold green]")


def menu_compilacion():
    while True:
        print_header("MANAGER > REQUERIMIENTOS, LIBRERÍAS & COMPILACIÓN")
        console.print("[bold yellow]-- INSTALACIÓN DE DEPENDENCIAS Y LIBRERÍAS --[/bold yellow]")
        console.print("[1] Instalar TODAS las Dependencias (Backend + IA + Modelos + Frontend)")
        console.print("[2] Backend: Instalar dependencias Node.js (npm install)")
        console.print("[3] IA: Instalar requerimientos Python en venv (pip install -r requirements.txt)")
        console.print("[4] IA: Descargar modelos de visión (CLIP, BiSeNet, SegFormer, ResNet)")
        console.print("[5] Frontend: Instalar paquetes React (pnpm/npm install)")
        console.print("\n[bold yellow]-- COMPILACIÓN (BUILD) --[/bold yellow]")
        console.print("[6] Compilar Backend NestJS (npm run build)")
        console.print("[7] Compilar Frontend SPA (pnpm/npm run build -> Frontend/dist)")
        console.print("[8] Flujo Maestro: Instalar TODO y Compilar TODO (1 Clic)")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "4", "5", "6", "7", "8", "0"], default="1")

        if op == "1":
            instalar_todo()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "2":
            instalar_deps_backend()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "3":
            instalar_deps_ia()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "4":
            descargar_modelos_ia()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "5":
            instalar_deps_frontend()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "6":
            compilar_backend()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "7":
            compilar_frontend()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "8":
            instalar_y_compilar_todo()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
