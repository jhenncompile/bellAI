"""Gestor de roles, contraseñas y permisos de PostgreSQL para BellAI."""
import os
import subprocess
from cli.console import console
from rich.prompt import Prompt
from cli.utils.env_manager import get_backend_config, fijar_env, BACKEND_ENV
from cli.utils.db_client import ping_postgres


def resetear_password_postgres_root():
    """Restablece la contraseña del usuario postgres sin necesidad de conocer la anterior.
    Utiliza autenticación peer mediante el usuario del sistema 'postgres'.
    """
    console.print("\n[bold cyan]Restablecer Contraseña de PostgreSQL (usuario 'postgres')[/bold cyan]")
    console.print("[dim]Se utilizará acceso administrativo peer local (no requiere contraseña anterior).[/dim]\n")

    cfg = get_backend_config()
    pass_actual_env = cfg.get("DB_PASSWORD", "BellaiSecurePass_2026!")

    nueva_pass = Prompt.ask(
        "Ingresa la nueva contraseña para el usuario 'postgres'",
        default=pass_actual_env if pass_actual_env != "tu_contraseña_segura" else "BellaiSecurePass_2026!",
    )

    # Escapar comillas simples
    pass_escaped = nueva_pass.replace("'", "''")
    sql_alter = f"ALTER USER postgres WITH PASSWORD '{pass_escaped}';"
    sql_grant = "GRANT ALL PRIVILEGES ON DATABASE bellia TO postgres;"

    # Intentar ejecutar como usuario postgres del sistema
    comandos = [
        ["su", "-", "postgres", "-c", f"psql -c \"{sql_alter}\""],
        ["sudo", "-u", "postgres", "psql", "-c", sql_alter],
    ]

    exito = False
    for cmd in comandos:
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if res.returncode == 0:
                exito = True
                break
        except Exception:
            continue

    if not exito:
        # Si estamos en Windows o psql directo
        try:
            res = subprocess.run(["psql", "-U", "postgres", "-c", sql_alter], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if res.returncode == 0:
                exito = True
        except Exception:
            pass

    if exito:
        fijar_env(BACKEND_ENV, "DB_PASSWORD", nueva_pass)
        console.print(f"[bold green]✔ Contraseña de 'postgres' restablecida exitosamente.[/bold green]")
        console.print(f"[green]✔ backend/.env actualizado con la nueva contraseña.[/green]")
        
        # Test de conexión inmediato
        ok, msg = ping_postgres()
        if ok:
            console.print("[bold green]✔ Conexión verificada: El backend ya puede comunicarse con PostgreSQL.[/bold green]")
        else:
            console.print(f"[yellow]Aviso de conexión: {msg}[/yellow]")
        return True
    else:
        console.print("[bold red]No se pudo ejecutar ALTER USER automáticamente.[/bold red]")
        console.print(f"[yellow]Ejecuta manualmente en tu terminal Linux como root:[/yellow]")
        console.print(f"  [bold cyan]su - postgres -c \"psql -c \\\"ALTER USER postgres WITH PASSWORD '{nueva_pass}';\\\"\"[/bold cyan]")
        fijar_env(BACKEND_ENV, "DB_PASSWORD", nueva_pass)
        return False


def crear_usuario_postgres():
    """Crea una nueva cuenta de usuario en PostgreSQL con permisos sobre bellia."""
    console.print("\n[bold cyan]Crear Nuevo Usuario / Rol en PostgreSQL[/bold cyan]")
    
    nuevo_user = Prompt.ask("Nombre del nuevo usuario de base de datos", default="bellia_app")
    nueva_pass = Prompt.ask("Contraseña para el nuevo usuario", default="Bellai_Pass2026!")
    db_name = Prompt.ask("Base de datos a la que tendrá acceso", default="bellia")

    pass_escaped = nueva_pass.replace("'", "''")
    user_escaped = nuevo_user.replace('"', '""')

    sql = f"""
    CREATE USER \"{user_escaped}\" WITH PASSWORD '{pass_escaped}' CREATEDB;
    GRANT ALL PRIVILEGES ON DATABASE \"{db_name}\" TO \"{user_escaped}\";
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"{user_escaped}\";
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"{user_escaped}\";
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"{user_escaped}\";
    """

    cmd = ["su", "-", "postgres", "-c", f"psql -d {db_name} -c \"{sql}\""]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=6)
        if res.returncode == 0 or "already exists" in res.stderr:
            console.print(f"[bold green]✔ Usuario '{nuevo_user}' configurado en PostgreSQL con permisos totales.[/bold green]")
            aplicar = Prompt.ask("¿Deseas configurar este nuevo usuario en backend/.env? (s/n)", choices=["s", "n"], default="s")
            if aplicar == "s":
                fijar_env(BACKEND_ENV, "DB_USER", nuevo_user)
                fijar_env(BACKEND_ENV, "DB_PASSWORD", nueva_pass)
                fijar_env(BACKEND_ENV, "DB_NAME", db_name)
                console.print(f"[green]✔ backend/.env actualizado con usuario '{nuevo_user}'.[/green]")
            return True
        else:
            console.print(f"[bold red]Error al crear usuario:[/bold red] {res.stderr.strip()}")
            return False
    except Exception as e:
        console.print(f"[bold red]Excepción al crear usuario:[/bold red] {e}")
        return False
