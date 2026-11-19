"""Consola estilizada con Rich para la herramienta CLI de BellAI."""
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

def print_header(title: str, subtitle: str = "Sistema de Asistencia de Imagen & Estilismo BellAI"):
    console.clear()
    panel_content = Text()
    panel_content.append("BELLAI ", style="bold #E07A5F")
    panel_content.append("• ", style="dim")
    panel_content.append(f"{title}\n", style="bold white")
    panel_content.append(subtitle, style="dim italic")
    
    console.print(Panel(panel_content, border_style="#E07A5F", expand=False))
