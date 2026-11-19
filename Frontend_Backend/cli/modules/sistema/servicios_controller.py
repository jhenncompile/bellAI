"""Controlador de Servicios Systemd y NGINX para BellaIA en Linux VPS / AWS."""
import os
import shutil
import subprocess
from cli.console import console
from rich.prompt import Prompt
from rich.panel import Panel
from rich.table import Table
from cli.utils.process_runner import run_cmd
from cli.utils.env_manager import fijar_env, BACKEND_ENV
from cli.modules.sistema.nginx_templates import generar_nginx_dominio, generar_nginx_ip

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
SYSTEMD_PATH = "/etc/systemd/system"
NGINX_SITES_AVAILABLE = "/etc/nginx/sites-available"
NGINX_SITES_ENABLED = "/etc/nginx/sites-enabled"
WEB_ROOT = "/var/www/bellia-frontend"

# Nombres exactos de servicios Systemd solicitados
SERVICE_BACKEND = "backendBellaIA"
SERVICE_AI = "IaBellaIA"

SERVICES = [
    (SERVICE_BACKEND, "API Principal NestJS 10 (Puerto 8000)"),
    (SERVICE_AI, "Microservicio de IA & Visión FastAPI (Puerto 8001)"),
    ("redis-server", "Caché en Memoria y Colas BullMQ (Puerto 6379)"),
    ("postgresql", "Base de Datos Relacional PostgreSQL 17 (Puerto 5432)"),
    ("nginx", "Servidor Web y Proxy Inverso HTTP/HTTPS"),
]


def es_root() -> bool:
    """Comprueba si el script corre con privilegios elevados en Linux."""
    try:
        return os.geteuid() == 0
    except AttributeError:
        return True  # En entornos Windows para desarrollo


def _detectar_node_path() -> str:
    """Busca la ruta del binario node en el sistema."""
    for p in ["/usr/bin/node", "/usr/local/bin/node", shutil.which("node")]:
        if p and os.path.exists(p):
            return p
    return "node"


def _detectar_python_ai_path() -> str:
    """Busca el intérprete de Python / Uvicorn para el microservicio de IA."""
    rutas = [
        os.path.join(BASE_DIR, "backend", "ai", ".venv", "bin", "uvicorn"),
        os.path.join(BASE_DIR, ".venv", "bin", "uvicorn"),
        "/usr/local/bin/uvicorn",
        "/usr/bin/uvicorn",
        shutil.which("uvicorn"),
    ]
    for r in rutas:
        if r and os.path.exists(r):
            return r
    return "uvicorn"


def existe_servicio() -> bool:
    """Verifica si ya están creados los servicios de BellaIA."""
    return os.path.exists(os.path.join(SYSTEMD_PATH, f"{SERVICE_BACKEND}.service"))


def ejecutar(modo: str):
    while True:
        console.print(f"\n[bold #E07A5F]=== GESTIÓN DE SERVICIOS ({'DOMINIO' if modo == 'dominio' else 'IP PÚBLICA'}) ===[/bold #E07A5F]")
        console.print(f"[1] Desplegar e Iniciar TODO ({SERVICE_BACKEND} + {SERVICE_AI} + NGINX + Frontend)")
        console.print("[2] Reiniciar TODO")
        console.print("[3] Detener Servicios Backend e IA")
        console.print("[4] Ver Estado de Servicios (Live Status)")
        console.print("[5] Ver Logs de Servicios en Tiempo Real")
        console.print("[6] Desinstalar Servicios de Systemd")
        console.print("[0] Volver")

        op = Prompt.ask("\nSelecciona una opción", default="1")

        if op == "1":
            crear_todo(modo)
        elif op == "2":
            reiniciar_todo()
        elif op == "3":
            detener_todo()
        elif op == "4":
            ver_estado()
        elif op == "5":
            menu_logs()
        elif op == "6":
            eliminar_todo()
        elif op == "0":
            break
        else:
            console.print("[red]Opción no válida.[/red]")


def crear_todo(modo: str):
    console.print(f"\n[bold cyan]⚙️  Generando servicios Systemd ({SERVICE_BACKEND} y {SERVICE_AI}) y NGINX...[/bold cyan]")
    
    if not es_root():
        console.print("[bold yellow]⚠️  Aviso: Se requieren privilegios de root (sudo) para escribir en /etc/systemd y /etc/nginx.[/bold yellow]")

    node_bin = _detectar_node_path()
    uvicorn_bin = _detectar_python_ai_path()

    backend_dir = os.path.join(BASE_DIR, "backend")
    dist_main = os.path.join(backend_dir, "dist", "main.js")
    
    # Comprobar si está buildeado el backend
    if not os.path.exists(dist_main):
        console.print("[yellow]Aviso: backend/dist/main.js no encontrado. Compilando NestJS...[/yellow]")
        run_cmd(["npm", "run", "build"], cwd=backend_dir)

    # 1. Servicio Systemd: Microservicio IA FastAPI (IaBellaIA.service)
    ai_dir = os.path.join(BASE_DIR, "backend", "ai")
    content_ai = f"""[Unit]
Description=BellaIA Computer Vision & AI Microservice (FastAPI en puerto 8001)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={ai_dir}
EnvironmentFile={BACKEND_ENV}
ExecStart={uvicorn_bin} app.main:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
"""

    # 2. Servicio Systemd: Backend NestJS (backendBellaIA.service)
    # Enlaza directamente a IaBellaIA para que al levantar backendBellaIA se asegure el servicio de IA
    content_backend = f"""[Unit]
Description=BellaIA Backend Principal (NestJS 10 en puerto 8000)
After=network.target postgresql.service redis-server.service {SERVICE_AI}.service
Wants={SERVICE_AI}.service

[Service]
Type=simple
User=root
WorkingDirectory={backend_dir}
EnvironmentFile={BACKEND_ENV}
ExecStart={node_bin} {dist_main}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
"""

    # Escribir en systemd
    try:
        os.makedirs(SYSTEMD_PATH, exist_ok=True)
        file_ai = os.path.join(SYSTEMD_PATH, f"{SERVICE_AI}.service")
        file_backend = os.path.join(SYSTEMD_PATH, f"{SERVICE_BACKEND}.service")
        
        with open(file_ai, "w", encoding="utf-8") as f:
            f.write(content_ai)
        with open(file_backend, "w", encoding="utf-8") as f:
            f.write(content_backend)
            
        console.print(f"[green]✔ Archivos systemd ({SERVICE_BACKEND}.service y {SERVICE_AI}.service) creados correctamente.[/green]")
    except Exception as e:
        console.print(f"[yellow]No se pudo escribir en {SYSTEMD_PATH}: {e}[/yellow]")

    # 3. Despliegue de Frontend buildeado a /var/www/bellia-frontend
    frontend_dist = os.path.join(BASE_DIR, "Frontend", "dist")
    if not os.path.exists(frontend_dist):
        console.print("[yellow]Aviso: Frontend/dist no encontrado. Ejecuta 'Preparación y Compilación' para generar el build de Vite.[/yellow]")
    else:
        try:
            os.makedirs(WEB_ROOT, exist_ok=True)
            for item in os.listdir(frontend_dist):
                s = os.path.join(frontend_dist, item)
                d = os.path.join(WEB_ROOT, item)
                if os.path.isdir(s):
                    if os.path.exists(d): shutil.rmtree(d)
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
            console.print(f"[green]✔ Build de Frontend copiado a {WEB_ROOT}[/green]")
        except Exception as e:
            console.print(f"[yellow]No se pudo copiar a {WEB_ROOT}: {e}[/yellow]")

    # 4. Configurar NGINX
    if modo == "dominio":
        dominio = Prompt.ask("Ingresa tu dominio (ej: bellia.tudominio.com)")
        conf_nginx = generar_nginx_dominio(dominio, WEB_ROOT)
        fijar_env(BACKEND_ENV, "CORS_ORIGIN", f"https://{dominio},http://{dominio},http://localhost:5173")
    else:
        ip = Prompt.ask("Ingresa la IP pública del VPS (o Enter para detección automática)", default="auto")
        if ip == "auto":
            try:
                import urllib.request
                ip = urllib.request.urlopen("https://api.ipify.org", timeout=3).read().decode("utf-8")
            except Exception:
                ip = "127.0.0.1"
        console.print(f"[cyan]Configurando para IP: {ip}[/cyan]")
        conf_nginx = generar_nginx_ip(ip, WEB_ROOT)
        fijar_env(BACKEND_ENV, "CORS_ORIGIN", f"http://{ip},http://localhost,http://localhost:5173")

    try:
        os.makedirs(NGINX_SITES_AVAILABLE, exist_ok=True)
        conf_path = os.path.join(NGINX_SITES_AVAILABLE, "bellia")
        with open(conf_path, "w", encoding="utf-8") as f:
            f.write(conf_nginx)
        
        os.makedirs(NGINX_SITES_ENABLED, exist_ok=True)
        enabled_path = os.path.join(NGINX_SITES_ENABLED, "bellia")
        if not os.path.exists(enabled_path):
            try:
                os.symlink(conf_path, enabled_path)
            except Exception:
                shutil.copy2(conf_path, enabled_path)
        
        default_site = os.path.join(NGINX_SITES_ENABLED, "default")
        if os.path.exists(default_site):
            try: os.remove(default_site)
            except Exception: pass

        console.print("[green]✔ Configuración de NGINX creada y enlazada.[/green]")
    except Exception as e:
        console.print(f"[yellow]No se pudo escribir en NGINX: {e}[/yellow]")

    # 5. Aplicar e iniciar en Systemd
    console.print(f"\n[bold cyan]Habilitando e iniciando {SERVICE_AI} y {SERVICE_BACKEND}...[/bold cyan]")
    run_cmd(["systemctl", "daemon-reload"], silent=True)
    run_cmd(["systemctl", "enable", SERVICE_AI], silent=True)
    run_cmd(["systemctl", "enable", SERVICE_BACKEND], silent=True)
    run_cmd(["systemctl", "restart", "redis-server"], silent=True)
    run_cmd(["systemctl", "restart", SERVICE_AI], silent=True)
    run_cmd(["systemctl", "restart", SERVICE_BACKEND], silent=True)
    run_cmd(["nginx", "-t"], silent=True)
    run_cmd(["systemctl", "restart", "nginx"], silent=True)

    console.print(f"[bold green]✔ Servicios {SERVICE_BACKEND} e {SERVICE_AI} desplegados e iniciados correctamente.[/bold green]")
    Prompt.ask("\nPresiona Enter para ver el estado de los servicios")
    ver_estado()


def reiniciar_todo():
    with console.status(f"[bold cyan]Reiniciando {SERVICE_BACKEND}, {SERVICE_AI}, Redis y NGINX..."):
        run_cmd(["systemctl", "restart", SERVICE_AI])
        run_cmd(["systemctl", "restart", SERVICE_BACKEND])
        run_cmd(["systemctl", "restart", "redis-server"])
        run_cmd(["systemctl", "restart", "nginx"])
    console.print("[bold green]✔ Servicios reiniciados.[/bold green]")
    ver_estado()


def detener_todo():
    with console.status(f"[bold yellow]Deteniendo {SERVICE_BACKEND} e {SERVICE_AI}..."):
        run_cmd(["systemctl", "stop", SERVICE_BACKEND])
        run_cmd(["systemctl", "stop", SERVICE_AI])
    console.print(f"[bold yellow]✔ Servicios {SERVICE_BACKEND} e {SERVICE_AI} detenidos.[/bold yellow]")
    ver_estado()


def eliminar_todo():
    confirm = Prompt.ask(f"[bold red]¿Estás seguro de eliminar los servicios {SERVICE_BACKEND} e {SERVICE_AI}?[/bold red] (s/n)", choices=["s", "n"], default="n")
    if confirm == "s":
        run_cmd(["systemctl", "stop", SERVICE_BACKEND], silent=True)
        run_cmd(["systemctl", "stop", SERVICE_AI], silent=True)
        run_cmd(["systemctl", "disable", SERVICE_BACKEND], silent=True)
        run_cmd(["systemctl", "disable", SERVICE_AI], silent=True)
        for s in [f"{SERVICE_BACKEND}.service", f"{SERVICE_AI}.service"]:
            p = os.path.join(SYSTEMD_PATH, s)
            if os.path.exists(p): os.remove(p)
        link = os.path.join(NGINX_SITES_ENABLED, "bellia")
        if os.path.exists(link): os.remove(link)
        run_cmd(["systemctl", "daemon-reload"], silent=True)
        console.print(f"[bold green]✔ Servicios {SERVICE_BACKEND} e {SERVICE_AI} desinstalados.[/bold green]")


def ver_estado():
    tabla = Table(title="Estado de Servicios BellaIA", show_header=True, header_style="bold magenta")
    tabla.add_column("Servicio", style="cyan")
    tabla.add_column("Descripción", style="white")
    tabla.add_column("Estado", style="bold")

    for s_name, desc in SERVICES:
        ok, out = run_cmd(["systemctl", "is-active", s_name], silent=True)
        status_clean = out.strip()
        if status_clean == "active":
            status_badge = "[bold green]● ACTIVO[/bold green]"
        elif status_clean == "inactive":
            status_badge = "[yellow]○ INACTIVO[/yellow]"
        elif status_clean == "failed":
            status_badge = "[bold red]✖ FALLIDO[/bold red]"
        else:
            status_badge = f"[dim]{status_clean or 'NO INSTALADO'}[/dim]"
        tabla.add_row(s_name, desc, status_badge)

    console.print(tabla)


def menu_logs():
    while True:
        console.print("\n[bold cyan]=== REGISTROS EN TIEMPO REAL (LOGS) ===[/bold cyan]")
        console.print(f"[1] Logs de {SERVICE_BACKEND} (NestJS API)")
        console.print(f"[2] Logs de {SERVICE_AI} (FastAPI IA)")
        console.print("[3] Logs de NGINX (Errores)")
        console.print("[4] Logs de Redis Server")
        console.print("[0] Volver")

        op = Prompt.ask("\nSelecciona un servicio", choices=["1", "2", "3", "4", "0"], default="0")
        if op == "1":
            subprocess.run(["journalctl", "-u", SERVICE_BACKEND, "-n", "40", "-f"])
        elif op == "2":
            subprocess.run(["journalctl", "-u", SERVICE_AI, "-n", "40", "-f"])
        elif op == "3":
            subprocess.run(["tail", "-n", "40", "-f", "/var/log/nginx/error.log"])
        elif op == "4":
            subprocess.run(["journalctl", "-u", "redis-server", "-n", "40", "-f"])
        elif op == "0":
            break
