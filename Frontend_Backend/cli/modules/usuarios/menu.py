"""Menú de gestión de usuarios y roles para BellAI."""
from cli.console import console, print_header
from rich.prompt import Prompt
from rich.table import Table
from cli.modules.usuarios.db_executor import (
    listar_usuarios,
    crear_usuario,
    cambiar_rol,
    toggle_activo,
    resetear_password,
)


def _ver_lista():
    users = listar_usuarios()
    if not users:
        console.print("[yellow]No se encontraron usuarios o la base de datos no está accesible.[/yellow]")
        return
    table = Table(title="Usuarias Registradas en BellAI", show_header=True, header_style="bold magenta")
    table.add_column("Nombre", style="white")
    table.add_column("Email", style="cyan")
    table.add_column("Rol", style="yellow")
    table.add_column("Estado", style="bold")
    table.add_column("Fecha Registro", style="dim")

    for u in users:
        est = "[bold green]Activo[/bold green]" if u["activo"] else "[bold red]Suspendido[/bold red]"
        table.add_row(u["nombre"], u["email"], u["rol"], est, u["creado_en"])
    console.print(table)


def menu_usuarios():
    while True:
        print_header("MANAGER > GESTIÓN DE USUARIOS")
        console.print("[1] Listar Usuarios")
        console.print("[2] Crear Nuevo Usuario (Admin o Regular)")
        console.print("[3] Cambiar Rol de Usuario (admin / manager / user)")
        console.print("[4] Activar / Suspender Cuenta")
        console.print("[5] Resetear Contraseña")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "4", "5", "0"], default="1")

        if op == "1":
            _ver_lista()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "2":
            email = Prompt.ask("Email del nuevo usuario")
            nombre = Prompt.ask("Nombre completo")
            pwd = Prompt.ask("Contraseña temporal (mínimo 8 caracteres)")
            rol = Prompt.ask("Rol", choices=["user", "manager", "admin"], default="user")
            ok = crear_usuario(email, pwd, nombre, rol)
            if ok:
                console.print(f"[bold green]✔ Usuario {email} creado exitosamente con rol {rol}.[/bold green]")
            else:
                console.print("[bold red]Error al crear usuario. Verifica que no exista ya el email.[/bold red]")
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "3":
            email = Prompt.ask("Email del usuario a modificar")
            nuevo_rol = Prompt.ask("Nuevo rol", choices=["admin", "manager", "user"])
            if cambiar_rol(email, nuevo_rol):
                console.print(f"[bold green]✔ Rol actualizado a '{nuevo_rol}' para {email}.[/bold green]")
            else:
                console.print("[red]No se encontró el usuario o no se pudo actualizar.[/red]")
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "4":
            email = Prompt.ask("Email del usuario")
            nuevo_estado = toggle_activo(email)
            if nuevo_estado is not None:
                txt = "ACTIVADA" if nuevo_estado else "SUSPENDIDA"
                console.print(f"[bold green]✔ Cuenta {email} ahora está {txt}.[/bold green]")
            else:
                console.print("[red]No se encontró el usuario.[/red]")
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "5":
            email = Prompt.ask("Email del usuario")
            pwd = Prompt.ask("Nueva contraseña")
            if resetear_password(email, pwd):
                console.print(f"[bold green]✔ Contraseña restablecida con éxito para {email}.[/bold green]")
            else:
                console.print("[red]No se pudo actualizar la contraseña.[/red]")
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
