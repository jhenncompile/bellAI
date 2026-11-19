"""Menú de gestión de Base de Datos para BellAI."""
from cli.console import console, print_header
from rich.prompt import Prompt
from cli.utils.db_client import ping_postgres, ping_redis
from cli.modules.db.schema_manager import inicializar_esquema, inspeccionar_tablas
from cli.modules.db.migrations import ejecutar_migraciones
from cli.modules.db.seeder import sembrar_usuario_admin
from cli.modules.db.backup import crear_backup, restaurar_backup
from cli.modules.db.roles_manager import resetear_password_postgres_root, crear_usuario_postgres

def menu_db():
    while True:
        print_header("MANAGER > BASE DE DATOS & CACHÉ")
        console.print("[1] Test de Conexión (PostgreSQL 17 & Redis 7)")
        console.print("[2] Restablecer Contraseña de 'postgres' (sin saber la anterior)")
        console.print("[3] Crear Nuevo Usuario / Rol en PostgreSQL (con permisos)")
        console.print("[4] Inicializar Esquema Completo (backend/schema.sql)")
        console.print("[5] Ejecutar Migraciones TypeORM (NestJS)")
        console.print("[6] Sembrar Cuenta Administradora Demo (valeria@bellia.com)")
        console.print("[7] Crear Copia de Seguridad (Backup pg_dump)")
        console.print("[8] Restaurar Copia de Seguridad")
        console.print("[9] Inspeccionar Tablas y Estadísticas")
        console.print("[0] Volver al Menú Principal")

        opcion = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], default="1")

        if opcion == "1":
            with console.status("[bold cyan]Comprobando conexiones..."):
                ok_pg, msg_pg = ping_postgres()
                ok_rd, msg_rd = ping_redis()
            
            console.print(f"[bold green]✔ PostgreSQL:[/bold green] {msg_pg}" if ok_pg else f"[bold red]✖ PostgreSQL:[/bold red] {msg_pg}")
            console.print(f"[bold green]✔ Redis:[/bold green] {msg_rd}" if ok_rd else f"[bold red]✖ Redis:[/bold red] {msg_rd}")
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "2":
            resetear_password_postgres_root()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "3":
            crear_usuario_postgres()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "4":
            inicializar_esquema()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "5":
            ejecutar_migraciones()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "6":
            sembrar_usuario_admin()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "7":
            crear_backup()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "8":
            restaurar_backup()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "9":
            inspeccionar_tablas()
            Prompt.ask("\nPresiona Enter para continuar")

        elif opcion == "0":
            break
