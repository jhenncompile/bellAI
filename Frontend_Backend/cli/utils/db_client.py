"""Cliente directo de PostgreSQL y Redis para la gestión de infraestructura de BellAI."""
import os
import subprocess
import socket
from typing import Tuple, List, Dict, Any, Optional
from cli.utils.env_manager import get_backend_config
from cli.console import console

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    HAVE_PSYCOPG2 = True
except ImportError:
    HAVE_PSYCOPG2 = False


def get_db_params() -> Dict[str, Any]:
    """Obtiene los parámetros de conexión desde backend/.env."""
    cfg = get_backend_config()
    return {
        "host": cfg.get("DB_HOST", "localhost"),
        "port": int(cfg.get("DB_PORT", "5432")),
        "user": cfg.get("DB_USER", "postgres"),
        "password": cfg.get("DB_PASSWORD", "postgres"),
        "database": cfg.get("DB_NAME", "bellia"),
    }


def get_redis_params() -> Dict[str, Any]:
    """Obtiene los parámetros de Redis desde backend/.env."""
    cfg = get_backend_config()
    return {
        "host": cfg.get("REDIS_HOST", "localhost"),
        "port": int(cfg.get("REDIS_PORT", "6379")),
    }


def ping_postgres() -> Tuple[bool, str]:
    """Prueba la conexión a PostgreSQL con psycopg2 o mediante conexión por socket TCP."""
    params = get_db_params()
    
    # Intento 1: Socket TCP rápido
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.5)
        s.connect((params["host"], params["port"]))
        s.close()
    except Exception as e:
        return False, f"Puerto PostgreSQL ({params['host']}:{params['port']}) inaccesible: {e}"

    # Intento 2: Autenticación con psycopg2
    if HAVE_PSYCOPG2:
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
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            cur.close()
            conn.close()
            return True, f"Conectado a PostgreSQL ({version.split(',')[0]})"
        except psycopg2.OperationalError as e:
            # Si la base de datos aún no existe, el servidor sí está activo
            err_msg = str(e)
            if f'database "{params["database"]}" does not exist' in err_msg:
                return True, f"Servidor PostgreSQL activo (la base de datos '{params['database']}' aún debe crearse)."
            return False, f"Fallo de autenticación en PostgreSQL: {err_msg.strip()}"
        except Exception as e:
            return False, f"Error en PostgreSQL: {e}"

    # Intento 3: CLI psql si no hay psycopg2
    cmd = ["psql", "-h", params["host"], "-p", str(params["port"]), "-U", params["user"], "-c", "SELECT 1;"]
    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]
    try:
        res = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=4)
        if res.returncode == 0:
            return True, "Conectado exitosamente vía psql CLI"
        return False, res.stderr.decode("utf-8", errors="ignore").strip()
    except FileNotFoundError:
        return True, f"Puerto {params['port']} abierto (psql/psycopg2 no instalados localmente)"
    except Exception as e:
        return False, str(e)


def ping_redis() -> Tuple[bool, str]:
    """Comprueba la disponibilidad de Redis."""
    params = get_redis_params()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.5)
        s.connect((params["host"], params["port"]))
        # Enviar comando PING del protocolo RESP
        s.sendall(b"*1\r\n$4\r\nPING\r\n")
        response = s.recv(1024)
        s.close()
        if b"+PONG" in response:
            return True, f"Redis respondiendo PONG en {params['host']}:{params['port']}"
        return True, f"Puerto Redis {params['port']} accesible"
    except Exception as e:
        return False, f"Redis no responde en {params['host']}:{params['port']}: {e}"


def asegurar_base_de_datos() -> Tuple[bool, str]:
    """Crea la base de datos bellia si no existe."""
    params = get_db_params()
    db_name = params["database"]

    if HAVE_PSYCOPG2:
        try:
            # Conectar a la base de datos por defecto 'postgres'
            conn = psycopg2.connect(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                database="postgres",
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{db_name}';")
            exists = cur.fetchone()
            if not exists:
                cur.execute(f'CREATE DATABASE "{db_name}" ENCODING "UTF8";')
                msg = f"Base de datos '{db_name}' creada exitosamente."
            else:
                msg = f"La base de datos '{db_name}' ya existe."
            cur.close()
            conn.close()
            return True, msg
        except Exception as e:
            return False, f"No se pudo asegurar la BD: {e}"

    # Fallback con psql
    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]
    cmd_check = ["psql", "-h", params["host"], "-p", str(params["port"]), "-U", params["user"], "-d", "postgres", "-tc", f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'"]
    res = subprocess.run(cmd_check, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if "1" not in res.stdout:
        cmd_create = ["psql", "-h", params["host"], "-p", str(params["port"]), "-U", params["user"], "-d", "postgres", "-c", f'CREATE DATABASE "{db_name}" ENCODING "UTF8";']
        res_c = subprocess.run(cmd_create, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res_c.returncode != 0:
            return False, res_c.stderr.strip()
        return True, f"Base de datos '{db_name}' creada exitosamente vía psql."
    return True, f"La base de datos '{db_name}' ya existe."


def ejecutar_script_sql(ruta_sql: str) -> Tuple[bool, str]:
    """Ejecuta un archivo .sql completo (como schema.sql) sobre la base de datos."""
    params = get_db_params()
    if not os.path.exists(ruta_sql):
        return False, f"El archivo SQL no existe: {ruta_sql}"

    if HAVE_PSYCOPG2:
        try:
            with open(ruta_sql, "r", encoding="utf-8") as f:
                sql_content = f.read()
            conn = psycopg2.connect(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                database=params["database"],
            )
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(sql_content)
            cur.close()
            conn.close()
            return True, f"Script {os.path.basename(ruta_sql)} ejecutado exitosamente."
        except Exception as e:
            return False, f"Error al ejecutar script: {e}"

    # Fallback con psql
    env = os.environ.copy()
    env["PGPASSWORD"] = params["password"]
    cmd = ["psql", "-h", params["host"], "-p", str(params["port"]), "-U", params["user"], "-d", params["database"], "-f", ruta_sql]
    res = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode == 0:
        return True, f"Script {os.path.basename(ruta_sql)} ejecutado con éxito vía psql."
    return False, res.stderr.strip()
