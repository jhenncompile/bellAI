"""Menú de diagnóstico y health checks."""
from cli.console import console, print_header
from rich.prompt import Prompt
from cli.modules.diagnostico.health_checker import diagnostico_completo

def menu_diagnostico():
    while True:
        print_header("MANAGER > DIAGNÓSTICO & HEALTH CHECKS")
        console.print("[1] Diagnóstico 360° en Vivo (Postgres, Redis, NestJS, IA, LLM, NGINX)")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "0"], default="1")

        if op == "1":
            with console.status("[bold cyan]Consultando todos los endpoints y servicios..."):
                diagnostico_completo()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
