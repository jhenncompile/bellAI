"""CLI Principal de Despliegue, Infraestructura y Operaciones BellAI."""
import os
import sys

# Asegurar que el directorio raíz del proyecto esté en el path de Python
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from cli.console import console, print_header
from rich.prompt import Prompt
from rich.panel import Panel
from rich.text import Text

from cli.modules.sistema.menu import menu_sistema
from cli.modules.db.menu import menu_db
from cli.modules.compilacion.menu import menu_compilacion
from cli.modules.diagnostico.menu import menu_diagnostico
from cli.modules.vps.menu import menu_vps
from cli.modules.config.menu import menu_config
from cli.modules.usuarios.menu import menu_usuarios


def main():
    while True:
        print_header("PANEL DE CONTROL & DESPLIEGUE CLOUD", "Herramienta DevOps & Administración VPS / AWS Linux")
        
        banner = Text()
        banner.append("  [1] ", style="bold cyan")
        banner.append("Servicios & Despliegue ", style="bold white")
        banner.append("(Systemd, NGINX, reverse proxy, logs en vivo)\n", style="dim")

        banner.append("  [2] ", style="bold cyan")
        banner.append("Base de Datos & Caché ", style="bold white")
        banner.append("(Postgres 17, schema.sql, migraciones, seeders, backups)\n", style="dim")

        banner.append("  [3] ", style="bold cyan")
        banner.append("Requerimientos, Librerías & Compilación ", style="bold white")
        banner.append("(Instalar npm/pip, descargar modelos IA y compilar)\n", style="dim")

        banner.append("  [4] ", style="bold cyan")
        banner.append("Diagnóstico & Health Checks 360° ", style="bold white")
        banner.append("(Ping y latencia en vivo de todos los servicios)\n", style="dim")

        banner.append("  [5] ", style="bold cyan")
        banner.append("Configuración VPS / AWS Linux ", style="bold white")
        banner.append("(Memoria SWAP, Firewall UFW, SSL Certbot, Recursos)\n", style="dim")

        banner.append("  [6] ", style="bold cyan")
        banner.append("Variables de Entorno & Secretos ", style="bold white")
        banner.append("(backend/.env, JWT, AES-256, CORS)\n", style="dim")

        banner.append("  [7] ", style="bold cyan")
        banner.append("Gestión de Usuarias y Roles ", style="bold white")
        banner.append("(Listar, crear admin, restablecer contraseñas)\n", style="dim")

        banner.append("  [0] ", style="bold red")
        banner.append("Salir\n", style="white")

        console.print(Panel(banner, border_style="#E07A5F", expand=False))

        op = Prompt.ask("Selecciona una opción", choices=["1", "2", "3", "4", "5", "6", "7", "0"], default="1")

        if op == "1":
            menu_sistema()
        elif op == "2":
            menu_db()
        elif op == "3":
            menu_compilacion()
        elif op == "4":
            menu_diagnostico()
        elif op == "5":
            menu_vps()
        elif op == "6":
            menu_config()
        elif op == "7":
            menu_usuarios()
        elif op == "0":
            console.print("\n[bold #E07A5F]Hasta pronto.[/bold #E07A5F]\n")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[dim]Operación cancelada por el usuario.[/dim]\n")
