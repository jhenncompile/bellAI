"""Gestor de copias de seguridad (Backups) y restauración para PostgreSQL BellAI."""
import os
import subprocess
import gzip
import shutil
from datetime import datetime
from cli.console import console
from rich.prompt import Prompt
from rich.table import Table
from cli.utils.db_client import get_db_params

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
BACKUP_DIR = os.path.join(BASE_DIR, "backups")


def asegurar_directorio():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def crear_backup() -> bool:
    """Genera un volcado comprimido .sql.gz de la base de datos bellia."""
    asegurar_directorio()
    params = get_db_params()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"bellia_backup_{timestamp}.sql.gz"
    ruta_destino = os.path.join(BACKUP_DIR, nombre_archivo)

    console.print(f"[cyan]Iniciando volcado de PostgreSQL para '{params['database']}'...[/cyan]")
    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]

    cmd = [
        "pg_dump",
        "-h", params["host"],
        "-p", str(params["port"]),
        "-U", params["user"],
        "-d", params["database"],
        "--clean",
        "--if-exists",
    ]

    try:
        p = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with gzip.open(ruta_destino, "wb") as gz_out:
            shutil.copyfileobj(p.stdout, gz_out)
        p.wait()

        if p.returncode == 0:
            tamano_mb = os.path.getsize(ruta_destino) / (1024 * 1024)
            console.print(f"[bold green]✔ Respaldo completado exitosamente:[/bold green] {nombre_archivo} ({tamano_mb:.2f} MB)")
            return True
        else:
            err = p.stderr.read().decode("utf-8", errors="ignore")
            console.print(f"[bold red]Fallo al ejecutar pg_dump:[/bold red] {err}")
            if os.path.exists(ruta_destino): os.remove(ruta_destino)
            return False
    except Exception as e:
        console.print(f"[bold red]Error en respaldo:[/bold red] {e}")
        return False


def listar_backups():
    asegurar_directorio()
    archivos = [f for f in os.listdir(BACKUP_DIR) if f.endswith(".sql.gz")]
    archivos.sort(reverse=True)
    return archivos


def restaurar_backup() -> bool:
    """Restaura un volcado seleccionado previamente."""
    backups = listar_backups()
    if not backups:
        console.print("[yellow]No existen archivos de respaldo en la carpeta backups/[/yellow]")
        return False

    tabla = Table(title="Copias de Seguridad Disponibles", show_header=True, header_style="bold magenta")
    tabla.add_column("#", style="cyan", width=4)
    tabla.add_column("Archivo", style="white")
    tabla.add_column("Tamaño", style="green")

    for idx, b in enumerate(backups, 1):
        ruta = os.path.join(BACKUP_DIR, b)
        sz = os.path.getsize(ruta) / 1024
        tabla.add_row(str(idx), b, f"{sz:.1f} KB")

    console.print(tabla)
    op = Prompt.ask("\nSelecciona el número de respaldo a restaurar (0 para cancelar)", default="0")
    if op == "0" or not op.isdigit() or int(op) > len(backups):
        return False

    elegido = backups[int(op) - 1]
    confirm = Prompt.ask(f"[bold red]ADVERTENCIA: Se sobreescribirán los datos con {elegido}. ¿Continuar?[/bold red] (s/n)", choices=["s", "n"], default="n")
    if confirm != "s":
        return False

    params = get_db_params()
    ruta_elegida = os.path.join(BACKUP_DIR, elegido)
    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]

    cmd = ["psql", "-h", params["host"], "-p", str(params["port"]), "-U", params["user"], "-d", params["database"]]
    try:
        with gzip.open(ruta_elegida, "rb") as gz_in:
            res = subprocess.run(cmd, env=env, stdin=gz_in, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0:
            console.print(f"[bold green]✔ Base de datos restaurada desde {elegido} exitosamente.[/bold green]")
            return True
        else:
            console.print(f"[yellow]psql terminó con advertencias:[/yellow] {res.stderr.decode('utf-8', errors='ignore')[:300]}")
            return True
    except Exception as e:
        console.print(f"[bold red]Error al restaurar:[/bold red] {e}")
        return False
