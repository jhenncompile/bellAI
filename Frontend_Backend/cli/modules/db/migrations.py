"""Gestor de migraciones TypeORM para el backend de BellAI."""
import os
from cli.console import console
from cli.utils.process_runner import run_cmd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")


def asegurar_node_modules():
    """Verifica si las dependencias de node_modules están instaladas en backend/."""
    nm_path = os.path.join(BACKEND_DIR, "node_modules")
    if not os.path.exists(nm_path) or not os.listdir(nm_path):
        console.print("[yellow]Aviso: backend/node_modules no encontrado. Instalando dependencias (npm install)...[/yellow]")
        run_cmd(["npm", "install"], cwd=BACKEND_DIR)


def ejecutar_migraciones() -> bool:
    """Ejecuta las migraciones pendientes de TypeORM en NestJS."""
    asegurar_node_modules()
    console.print("\n[bold cyan]Ejecutando migraciones TypeORM en backend...[/bold cyan]")

    # Intento 1: Script oficial de package.json
    ok, out = run_cmd(["npm", "run", "migration:run"], cwd=BACKEND_DIR)
    if ok and "has been executed successfully" in out or "No migrations are pending" in out or ok:
        console.print("[bold green]✔ Migraciones TypeORM verificadas y aplicadas con éxito.[/bold green]")
        return True

    # Intento 2: Si falla por ts-node, compilar NestJS y correr contra dist/config/data-source.js
    console.print("[yellow]Intentando ejecución con TypeORM CLI sobre código compilado...[/yellow]")
    dist_ds = os.path.join(BACKEND_DIR, "dist", "config", "data-source.js")
    if not os.path.exists(dist_ds):
        console.print("[cyan]Compilando backend (npm run build)...[/cyan]")
        run_cmd(["npm", "run", "build"], cwd=BACKEND_DIR)

    typeorm_bin = os.path.join(BACKEND_DIR, "node_modules", "typeorm", "cli.js")
    if os.path.exists(typeorm_bin) and os.path.exists(dist_ds):
        ok2, out2 = run_cmd(["node", "-r", "dotenv/config", typeorm_bin, "migration:run", "-d", "dist/config/data-source.js"], cwd=BACKEND_DIR)
        if ok2:
            console.print("[bold green]✔ Migraciones TypeORM aplicadas con éxito sobre dist/.[/bold green]")
            return True

    console.print(f"[yellow]Aviso de TypeORM: {out[:400]}[/yellow]")
    console.print("[dim]Nota: Si ya cargaste backend/schema.sql (Opción [4]), el esquema maestro ya está 100% activo.[/dim]")
    return False
