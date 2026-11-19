"""Seeder de datos esenciales para BellAI (Cuenta administradora y demostración)."""
import os
import uuid
import bcrypt
from cli.console import console
from cli.utils.db_client import get_db_params, HAVE_PSYCOPG2

if HAVE_PSYCOPG2:
    import psycopg2

ADMIN_EMAIL = "valeria@bellia.com"
ADMIN_PASS_RAW = "123456789"
ADMIN_NAME = "Valeria"
ADMIN_ROLE = "admin"


def sembrar_usuario_admin() -> bool:
    """Crea o actualiza la cuenta administradora de demostración en PostgreSQL."""
    params = get_db_params()
    
    # Generar hash seguro con bcrypt
    salt = bcrypt.gensalt(rounds=10)
    hashed_pwd = bcrypt.hashpw(ADMIN_PASS_RAW.encode("utf-8"), salt).decode("utf-8")
    
    user_id = str(uuid.uuid4())

    sql_usuario = """
    INSERT INTO usuario (id, email, contrasena_hash, rol, activo, creado_en, actualizado_en)
    VALUES (%s, %s, %s, %s, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (email) DO UPDATE 
    SET contrasena_hash = EXCLUDED.contrasena_hash, rol = 'admin', activo = true, actualizado_en = CURRENT_TIMESTAMP
    RETURNING id;
    """

    sql_perfil = """
    INSERT INTO perfil (usuario_id, nombre, apellido, biografia, avatar_url, creado_en, actualizado_en)
    VALUES (%s, %s, 'Gómez', 'Usuaria Administradora de Demostración BellAI', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (usuario_id) DO NOTHING;
    """

    sql_preferencias = """
    INSERT INTO preferencias (usuario_id, notificaciones_email, notificaciones_push, tema, estilo_favorito)
    VALUES (%s, true, true, 'sistema', 'Clásico & Sofisticado')
    ON CONFLICT (usuario_id) DO NOTHING;
    """

    if HAVE_PSYCOPG2:
        try:
            conn = psycopg2.connect(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                database=params["database"],
            )
            conn.autocommit = True
            cur = conn.cursor()
            
            cur.execute(sql_usuario, (user_id, ADMIN_EMAIL, hashed_pwd, ADMIN_ROLE))
            row = cur.fetchone()
            actual_user_id = row[0] if row else user_id

            cur.execute(sql_perfil, (actual_user_id, ADMIN_NAME))
            cur.execute(sql_preferencias, (actual_user_id,))

            cur.close()
            conn.close()
            console.print(f"[bold green]✔ Usuaria sembrada exitosamente:[/bold green] {ADMIN_EMAIL} (Contraseña: {ADMIN_PASS_RAW}, Rol: {ADMIN_ROLE})")
            return True
        except Exception as e:
            console.print(f"[bold red]Error al sembrar usuario:[/bold red] {e}")
            return False

    console.print("[yellow]psycopg2 no disponible; se recomienda instalar las dependencias con manager.sh[/yellow]")
    return False
