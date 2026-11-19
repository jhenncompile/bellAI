"""Menú de gestión de despliegue y servicios para BellAI."""
from cli.console import console, print_header
from rich.panel import Panel
from rich.prompt import Prompt
from cli.modules.sistema.servicios_controller import ejecutar as ejecutar_servicios, ver_estado

def menu_sistema():
    while True:
        print_header("MANAGER > SERVICIOS & DESPLIEGUE")
        console.print("[1] Despliegue por Dominio (ej: bellia.app con SSL)")
        console.print("[2] Despliegue por IP Pública (acceso directo en puerto 80)")
        console.print("[3] Ver Estado en Vivo de Servicios")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "0"], default="1")

        if op == "1":
            ejecutar_servicios("dominio")
        elif op == "2":
            ejecutar_servicios("ip")
        elif op == "3":
            ver_estado()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
        else:
            console.print("[red]Opción no válida.[/red]")
