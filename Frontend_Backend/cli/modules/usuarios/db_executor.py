"""Operaciones directas de usuarios y roles sobre PostgreSQL para BellAI."""
import uuid
import bcrypt
from typing import List, Dict, Any, Optional
from cli.utils.db_client import get_db_params, HAVE_PSYCOPG2

if HAVE_PSYCOPG2:
    import psycopg2


def listar_usuarios() -> List[Dict[str, Any]]:
    """Devuelve la lista de usuarios con sus perfiles."""
    params = get_db_params()
    usuarios = []
    if not HAVE_PSYCOPG2:
        return usuarios

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
        cur.execute("""
            SELECT u.id, u.email, u.rol, u.activo, COALESCE(p.nombre, 'Sin nombre') AS nombre, u.creado_en
            FROM usuario u
            LEFT JOIN perfil p ON p.usuario_id = u.id
            ORDER BY u.creado_en DESC;
        """)
        for r in cur.fetchall():
            usuarios.append({
                "id": str(r[0]),
                "email": r[1],
                "rol": r[2],
                "activo": r[3],
                "nombre": r[4],
                "creado_en": str(r[5])[:19] if r[5] else "-",
            })
        cur.close()
        conn.close()
    except Exception:
        pass
    return usuarios


def crear_usuario(email: str, password_raw: str, nombre: str, rol: str = "user") -> bool:
    """Crea un usuario nuevo con contraseña encriptada con bcrypt."""
    params = get_db_params()
    if not HAVE_PSYCOPG2:
        return False

    salt = bcrypt.gensalt(rounds=10)
    hash_pwd = bcrypt.hashpw(password_raw.encode("utf-8"), salt).decode("utf-8")
    u_id = str(uuid.uuid4())

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
        cur.execute(
            "INSERT INTO usuario (id, email, contrasena_hash, rol, activo) VALUES (%s, %s, %s, %s, true);",
            (u_id, email.strip().lower(), hash_pwd, rol),
        )
        cur.execute(
            "INSERT INTO perfil (usuario_id, nombre) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (u_id, nombre.strip()),
        )
        cur.execute(
            "INSERT INTO preferencias (usuario_id) VALUES (%s) ON CONFLICT DO NOTHING;",
            (u_id,),
        )
        cur.close()
        conn.close()
        return True
    except Exception:
        return False


def cambiar_rol(email: str, nuevo_rol: str) -> bool:
    """Modifica el rol de un usuario existente ('admin', 'manager', 'user')."""
    params = get_db_params()
    if not HAVE_PSYCOPG2:
        return False
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
        cur.execute("UPDATE usuario SET rol = %s, actualizado_en = CURRENT_TIMESTAMP WHERE email = %s;", (nuevo_rol, email.strip().lower()))
        rows = cur.rowcount
        cur.close()
        conn.close()
        return rows > 0
    except Exception:
        return False


def toggle_activo(email: str) -> Optional[bool]:
    """Invierte el estado de activación de una cuenta (activo = not activo)."""
    params = get_db_params()
    if not HAVE_PSYCOPG2:
        return None
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
        cur.execute("UPDATE usuario SET activo = NOT activo, actualizado_en = CURRENT_TIMESTAMP WHERE email = %s RETURNING activo;", (email.strip().lower(),))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


def resetear_password(email: str, nueva_pass: str) -> bool:
    """Restablece la contraseña de un usuario."""
    params = get_db_params()
    if not HAVE_PSYCOPG2:
        return False
    salt = bcrypt.gensalt(rounds=10)
    hash_pwd = bcrypt.hashpw(nueva_pass.encode("utf-8"), salt).decode("utf-8")
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
        cur.execute("UPDATE usuario SET contrasena_hash = %s, actualizado_en = CURRENT_TIMESTAMP WHERE email = %s;", (hash_pwd, email.strip().lower()))
        rows = cur.rowcount
        cur.close()
        conn.close()
        return rows > 0
    except Exception:
        return False
