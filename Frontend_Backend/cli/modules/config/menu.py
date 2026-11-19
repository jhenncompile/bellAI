"""Menú de configuración de variables de entorno para BellAI."""
import secrets
from cli.console import console, print_header
from rich.prompt import Prompt
from rich.table import Table
from cli.utils.env_manager import get_backend_config, fijar_env, BACKEND_ENV


def _ocultar(clave: str) -> bool:
    return any(p in clave for p in ("PASSWORD", "SECRET", "KEY", "TOKEN", "INTERNAL"))


def ver_variables():
    cfg = get_backend_config()
    tabla = Table(title="Variables de Entorno (backend/.env)", show_header=True, header_style="bold magenta")
    tabla.add_column("Variable", style="cyan")
    tabla.add_column("Valor Actual", style="green")

    for k, v in sorted(cfg.items()):
        val_str = str(v)
        if _ocultar(k) and not k.endswith("_URL"):
            val_str = "••••••••••••••••" if v else "[dim]No configurada[/dim]"
        elif not v:
            val_str = "[dim]No configurada[/dim]"
        tabla.add_row(k, val_str)

    console.print(tabla)


def generar_secretos_criptograficos():
    """Genera claves criptográficas seguras para JWT_SECRET y ENCRYPTION_KEY."""
    console.print("\n[cyan]Generando claves criptográficas seguras...[/cyan]")
    nuevo_jwt = secrets.token_urlsafe(48)
    nueva_enc = secrets.token_hex(32)  # 256 bits para AES-GCM

    fijar_env(BACKEND_ENV, "JWT_SECRET", nuevo_jwt)
    fijar_env(BACKEND_ENV, "ENCRYPTION_KEY", nueva_enc)
    console.print("[bold green]✔ JWT_SECRET y ENCRYPTION_KEY generados y guardados en backend/.env[/bold green]")


def editar_variable():
    clave = Prompt.ask("Nombre de la variable que deseas modificar (ej: CORS_ORIGIN, DB_HOST, KIMI_API_KEY)")
    cfg = get_backend_config()
    actual = cfg.get(clave, "")
    console.print(f"Valor actual: [yellow]{actual or '(vacío)'}[/yellow]")
    nuevo = Prompt.ask("Nuevo valor", default=actual)
    fijar_env(BACKEND_ENV, clave, nuevo)
    console.print(f"[bold green]✔ Variable {clave} actualizada con éxito.[/bold green]")


def menu_config():
    while True:
        print_header("MANAGER > CONFIGURACIÓN & ENTORNOS")
        console.print("[1] Ver Variables de Entorno (backend/.env)")
        console.print("[2] Editar Variable Específica")
        console.print("[3] Regenerar Secretos Criptográficos (JWT y AES-256)")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "0"], default="1")

        if op == "1":
            ver_variables()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "2":
            editar_variable()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "3":
            generar_secretos_criptograficos()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
