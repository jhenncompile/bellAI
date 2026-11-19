"""Gestor de esquema e inspección de tablas para BellAI."""
import os
from cli.console import console
from rich.table import Table
from cli.utils.db_client import get_db_params, asegurar_base_de_datos, ejecutar_script_sql, HAVE_PSYCOPG2

if HAVE_PSYCOPG2:
    import psycopg2

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
SCHEMA_SQL = os.path.join(BASE_DIR, "backend", "schema.sql")

TABLAS_BELLAI = [
    "usuario",
    "perfil",
    "preferencias",
    "dispositivo_push",
    "fotografia",
    "diagnostico",
    "prenda",
    "combinacion",
    "avatar",
    "tarea",
    "incidente",
    "auditoria",
]


def inicializar_esquema() -> bool:
    """Crea la base de datos bellia e importa el esquema oficial de backend/schema.sql."""
    with console.status("[bold cyan]Asegurando existencia de la base de datos bellia..."):
        ok_db, msg_db = asegurar_base_de_datos()
        console.print(f"[green]✔ {msg_db}[/green]" if ok_db else f"[yellow]! {msg_db}[/yellow]")

    if not os.path.exists(SCHEMA_SQL):
        console.print(f"[bold red]No se encontró el archivo de esquema:[/bold red] {SCHEMA_SQL}")
        return False

    with console.status("[bold cyan]Cargando tablas, tipos ENUM e índices desde schema.sql..."):
        ok, msg = ejecutar_script_sql(SCHEMA_SQL)
        if ok:
            console.print(f"[bold green]✔ Esquema cargado exitosamente:[/bold green] {msg}")
            return True
        else:
            console.print(f"[bold red]Fallo al cargar schema.sql:[/bold red] {msg}")
            return False


def inspeccionar_tablas():
    """Muestra el conteo de filas y tamaño de las tablas principales del sistema."""
    params = get_db_params()
    tabla_ui = Table(title=f"Estado de Tablas en '{params['database']}'", show_header=True, header_style="bold magenta")
    tabla_ui.add_column("Tabla", style="cyan")
    tabla_ui.add_column("Registros", justify="right", style="green")
    tabla_ui.add_column("Estado", style="dim")

    if HAVE_PSYCOPG2:
        try:
            conn = psycopg2.connect(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                database=params["database"],
                connect_timeout=3,
            )
            cur = conn.cursor()
            for tbl in TABLAS_BELLAI:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {tbl};")
                    count = cur.fetchone()[0]
                    tabla_ui.add_row(tbl, str(count), "[green]OK[/green]")
                except Exception:
                    conn.rollback()
                    tabla_ui.add_row(tbl, "-", "[dim]No creada[/dim]")
            cur.close()
            conn.close()
            console.print(tabla_ui)
            return
        except Exception as e:
            console.print(f"[yellow]No se pudo consultar PostgreSQL directamente: {e}[/yellow]")

    console.print("[dim]Se requiere conexión activa para inspeccionar tablas.[/dim]")
