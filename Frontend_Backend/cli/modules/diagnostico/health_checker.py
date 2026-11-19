"""Verificación integral de salud y conectividad de todos los componentes de BellAI."""
import time
import requests
from cli.console import console
from rich.table import Table
from cli.utils.db_client import ping_postgres, ping_redis
from cli.utils.env_manager import get_backend_config


def diagnostico_completo():
    """Ejecuta una inspección integral de los servicios del ecosistema BellAI."""
    cfg = get_backend_config()
    tabla = Table(title="Diagnóstico 360° de Conectividad & Servicios", show_header=True, header_style="bold magenta")
    tabla.add_column("Componente", style="cyan")
    tabla.add_column("Destino / Puerto", style="white")
    tabla.add_column("Latencia", justify="right", style="yellow")
    tabla.add_column("Estado", style="bold")

    # 1. PostgreSQL
    t0 = time.time()
    ok_pg, msg_pg = ping_postgres()
    lat_pg = (time.time() - t0) * 1000
    tabla.add_row(
        "Base de Datos (PostgreSQL 17)",
        f"{cfg.get('DB_HOST', 'localhost')}:{cfg.get('DB_PORT', '5432')}",
        f"{lat_pg:.1f} ms",
        "[bold green]● CONECTADO[/bold green]" if ok_pg else f"[bold red]✖ ERROR[/bold red] ({msg_pg[:20]})",
    )

    # 2. Redis
    t0 = time.time()
    ok_rd, msg_rd = ping_redis()
    lat_rd = (time.time() - t0) * 1000
    tabla.add_row(
        "Caché & Colas (Redis 7)",
        f"{cfg.get('REDIS_HOST', 'localhost')}:{cfg.get('REDIS_PORT', '6379')}",
        f"{lat_rd:.1f} ms",
        "[bold green]● CONECTADO[/bold green]" if ok_rd else f"[bold red]✖ ERROR[/bold red]",
    )

    # 3. Backend NestJS
    port = cfg.get("PORT", "8000")
    url_b = f"http://127.0.0.1:{port}/api/docs"
    try:
        t0 = time.time()
        res = requests.get(url_b, timeout=2.5)
        lat_b = (time.time() - t0) * 1000
        estado_b = "[bold green]● ONLINE (HTTP " + str(res.status_code) + ")[/bold green]" if res.status_code < 500 else "[red]HTTP " + str(res.status_code) + "[/red]"
    except Exception as e:
        lat_b = 0
        estado_b = "[bold red]✖ INACCESIBLE[/bold red]"
    tabla.add_row("API Principal (NestJS)", f"http://localhost:{port}/api", f"{lat_b:.1f} ms" if lat_b else "-", estado_b)

    # 4. Microservicio de IA FastAPI
    ai_url = cfg.get("AI_SERVICE_URL", "http://localhost:8001") + "/health"
    try:
        t0 = time.time()
        res = requests.get(ai_url, timeout=3.0)
        lat_ai = (time.time() - t0) * 1000
        data = res.json() if res.status_code == 200 else {}
        estado_ai = f"[bold green]● HEALTHY ({data.get('device', 'cpu')})[/bold green]" if res.status_code == 200 else "[red]HTTP " + str(res.status_code) + "[/red]"
    except Exception:
        lat_ai = 0
        estado_ai = "[bold red]✖ INACCESIBLE[/bold red]"
    tabla.add_row("Servicio de IA (FastAPI)", ai_url.replace("/health", ""), f"{lat_ai:.1f} ms" if lat_ai else "-", estado_ai)

    # 5. Asistente Conversacional (Ollama o Kimi)
    kimi_key = cfg.get("KIMI_API_KEY", "")
    if kimi_key:
        tabla.add_row("Asistente (LLM)", "API Moonshot (Kimi)", "-", "[bold green]● CONFIGURADO[/bold green]")
    else:
        ollama_url = cfg.get("OLLAMA_URL", "http://localhost:11434")
        try:
            t0 = time.time()
            res = requests.get(ollama_url, timeout=2.0)
            lat_ol = (time.time() - t0) * 1000
            estado_ol = "[bold green]● ACTIVO[/bold green]" if res.status_code == 200 else "[yellow]HTTP " + str(res.status_code) + "[/yellow]"
        except Exception:
            lat_ol = 0
            estado_ol = "[yellow]○ NO INICIADO[/yellow]"
        tabla.add_row("Asistente (LLM Local)", ollama_url, f"{lat_ol:.1f} ms" if lat_ol else "-", estado_ol)

    # 6. Servidor Web NGINX
    try:
        t0 = time.time()
        res = requests.get("http://127.0.0.1", timeout=1.5)
        lat_ng = (time.time() - t0) * 1000
        estado_ng = "[bold green]● ESCUCHANDO[/bold green]"
    except Exception:
        lat_ng = 0
        estado_ng = "[dim]No responde en puerto 80[/dim]"
    tabla.add_row("Servidor Web (NGINX)", "http://localhost:80", f"{lat_ng:.1f} ms" if lat_ng else "-", estado_ng)

    console.print(tabla)
