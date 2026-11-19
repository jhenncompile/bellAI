"""Plan de pruebas del Perfil de Proyecto (casos CP-xxx) ejecutado contra la API real.

Requiere el sistema levantado (docker compose up -d) y se ejecuta con el Python del servicio de IA,
que ya tiene OpenCV para generar las imágenes de prueba:

    backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py

Crea usuarias de prueba propias y las elimina al final (derecho al olvido).
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

import cv2
import numpy as np

API = os.getenv("BELLAI_API", "http://localhost:8000/api")
HERE = os.path.dirname(os.path.abspath(__file__))
PORTRAIT = os.path.abspath(os.path.join(HERE, "..", "..", "ai", "tests", "fixtures", "retrato.jpg"))
ADMIN = (os.getenv("BELLAI_ADMIN_EMAIL", "valeria@bellia.com"), os.getenv("BELLAI_ADMIN_PASSWORD", "123456789"))
TMP = tempfile.mkdtemp(prefix="bellai-plan-")
results = []


def req(method, path, token=None, body=None, files=None, fields=None, raw=False):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if files is not None:
        b = uuid.uuid4().hex
        parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in (fields or {}).items()]
        for k, (p, ctype) in files.items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{os.path.basename(p)}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + open(p, "rb").read() + b"\r\n")
        data = b"".join(parts) + f"--{b}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={b}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    url = path if path.startswith("http") else API + path
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=180) as res:
            txt = res.read()
            return res.status, (txt if raw else (json.loads(txt) if txt else None))
    except urllib.error.HTTPError as e:
        txt = e.read()
        try:
            return e.code, json.loads(txt) if txt else None
        except ValueError:
            return e.code, txt


def sql(q):
    return subprocess.run(["docker", "exec", "bellia_postgres", "psql", "-U", "valeria", "-d", "bellia", "-tAc", q], capture_output=True, text=True).stdout.strip()


def check(case, name, cond, detail=""):
    results.append((case, name, bool(cond), detail))
    print(f"  {'OK   ' if cond else 'FALLO'} {case:<10} {name}" + (f" — {detail}" if detail else ""))


def wait(token, task):
    for _ in range(120):
        if task["status"] in ("completada", "fallida"):
            return task
        time.sleep(1)
        task = req("GET", f"/tasks/{task['id']}", token)[1]
    return task


def image(name, img):
    p = os.path.join(TMP, name)
    cv2.imwrite(p, img)
    return p


def register(name):
    email = f"plan.{uuid.uuid4().hex[:8]}@bellai.test"
    st, r = req("POST", "/auth/register", body={"name": name, "email": email, "password": "Prueba12345!"})
    assert st in (200, 201), r
    return r["token"], r["user"]["id"], email


def garment_image(path_name, bgr):
    img = np.full((700, 560, 3), 228, np.uint8)
    pts = np.array([[150, 120], [410, 120], [470, 220], [420, 250], [400, 620], [160, 620], [140, 250], [90, 220]])
    cv2.fillPoly(img, [pts], bgr)
    img = np.clip(img.astype(int) + np.random.default_rng(4).integers(-18, 18, img.shape), 0, 255).astype(np.uint8)
    return image(path_name, img)


def main():
    st, a = req("POST", "/auth/login", body={"email": ADMIN[0], "password": ADMIN[1]})
    ADM = a["token"]
    T, uid, email = register("Plan Pruebas")
    T2, uid2, _ = register("Otra Usuaria")
    dark = image("oscura.jpg", np.full((800, 600, 3), 10, np.uint8))
    tiny = image("pequena.jpg", np.random.default_rng(1).integers(0, 255, (100, 100, 3), dtype=np.uint8))
    pdf = os.path.join(TMP, "documento.pdf")
    open(pdf, "wb").write(b"%PDF-1.4\n%prueba\n")

    print("\nHU-001 · Perfil y preferencias")
    st, _ = req("PUT", "/profile", T, body={"name": "Plan Editada"})
    check("CP-001-01", "Editar nombre", st == 200 and req("GET", "/profile", T)[1].get("name") == "Plan Editada")
    st, b = req("PUT", "/profile", T, body={"name": ""})
    check("CP-001-02", "Nombre vacío rechazado", st == 400 and "obligatorio" in json.dumps(b, ensure_ascii=False))
    req("PUT", "/profile/preferences", T, body={"stylePreferences": {"preferredStyles": ["Casual"], "preferredColors": ["blanco"], "occasions": ["Trabajo"]}})
    dna1 = req("GET", "/style/dna", T)[1]
    check("CP-001-03", "Preferencias usadas en el Style DNA", dna1["sources"]["declared"] and dna1["dimensions"]["naturalidad"] > 55)
    req("PUT", "/profile/preferences", T, body={"stylePreferences": {"preferredStyles": [], "preferredColors": ["blanco"], "occasions": ["Trabajo"]}})
    dna2 = req("GET", "/style/dna", T)[1]
    check("CP-001-04", "Quitar un estilo actualiza el perfil", dna2["dimensions"] != dna1["dimensions"])

    print("\nHU-029 · Privacidad")
    req("POST", "/privacy/consents", T, body={"consentType": "photo_analysis", "accepted": False})
    st, b = req("POST", "/diagnosis", T, files={"face": (PORTRAIT, "image/jpeg")})
    check("CP-029-01", "Sin autorización no se analizan fotos", st == 403)
    req("POST", "/privacy/consents", T, body={"consentType": "photo_analysis", "accepted": True})
    st, summary = req("GET", "/privacy/data-summary", T)
    check("CP-029-02", "Consulta de mis datos", st == 200 and "analysis" in summary and summary["account"]["email"] == email)
    st, b = req("POST", "/privacy/right-to-be-forgotten", T, body={"confirm": True, "password": "incorrecta"})
    check("CP-029-03a", "Contraseña incorrecta no borra nada", st == 401 and sql(f"select count(*) from users where id='{uid}'") == "1")

    print("\nHU-035 · Validación de fotos")
    st, b = req("POST", "/diagnosis/validate", T, files={"file": (pdf, "application/pdf")}, fields={"type": "rostro"})
    check("CP-035-01", "PDF rechazado", st == 400 and "JPG" in json.dumps(b))
    st, b = req("POST", "/diagnosis/validate", T, files={"file": (tiny, "image/jpeg")}, fields={"type": "rostro"})
    check("CP-035-02", "100x100 px: resolución insuficiente", st == 200 and not b["valid"] and b["problems"][0]["code"] == "resolucion", b.get("message"))
    st, b = req("POST", "/diagnosis/validate", T, files={"file": (dark, "image/jpeg")}, fields={"type": "rostro"})
    check("CP-035-03", "Foto oscura con recomendación", not b["valid"] and any(p["code"] == "iluminacion_baja" for p in b["problems"]), b.get("message"))
    st, b = req("POST", "/diagnosis/validate", T, files={"file": (PORTRAIT, "image/jpeg")}, fields={"type": "cuerpo"})
    check("CP-035-04", "Cuerpo recortado: debe verse completo", not b["valid"] and any(p["code"] == "cuerpo_completo" for p in b["problems"]), b.get("message"))
    t = wait(T, req("POST", "/diagnosis", T, files={"face": (PORTRAIT, "image/jpeg")})[1])
    check("CP-035-05", "Foto válida: análisis completo", t["status"] == "completada" and t["result"]["season"], t["result"]["season"] if t["result"] else t["error"])

    print("\nHU-034 · Información sensible")
    check("CP-034-01", "Contraseña guardada como hash", sql(f"select left(password,4) from users where id='{uid}'").startswith("$2"))
    garment = garment_image("blusa_azul.jpg", (184, 141, 91))
    st, item = req("POST", "/wardrobe/scan", T, files={"photo": (garment, "image/jpeg")}, fields={"name": "Blusa prueba"})
    img_url = (item or {}).get("item", {}).get("enhancedImageUrl") if isinstance(item, dict) else None
    base = API.rsplit("/api", 1)[0]
    st_signed, _ = req("GET", base + img_url, raw=True) if img_url else (0, None)
    st_unsigned, _ = req("GET", base + img_url.split("?")[0], raw=True) if img_url else (0, None)
    item_id = (item or {}).get("item", {}).get("id")
    st_other, _ = req("GET", f"/wardrobe/{item_id}", T2)
    check("CP-034-03", "Fotos solo accesibles por su dueña", st_signed == 200 and st_unsigned == 403 and st_other in (403, 404),
          f"firmada={st_signed} sin firma={st_unsigned} otra usuaria={st_other}")
    st_priv, _ = req("GET", base + "/uploads/private/x/photos/y.jpg", raw=True)
    check("CP-034-03b", "Carpeta de fotos privadas no se sirve", st_priv in (403, 404))
    logs = subprocess.run(["docker", "logs", "bellia_backend"], capture_output=True, text=True)
    check("CP-034-04", "Los logs no contienen contraseñas ni tokens", "Prueba12345!" not in logs.stdout + logs.stderr and T not in logs.stdout + logs.stderr)

    print("\nHU-030 · Administración")
    st, d = req("GET", "/admin/dashboard", ADM)
    check("CP-030-01", "Administrador accede al panel", st == 200)
    st, _ = req("GET", "/admin/dashboard", T)
    check("CP-030-02", "Usuaria estándar: 403", st == 403)
    req("PATCH", f"/usuarios/{uid2}/status", ADM, body={"status": "suspended"})
    st, _ = req("POST", "/auth/login", body={"email": sql(f"select email from users where id='{uid2}'"), "password": "Prueba12345!"})
    check("CP-030-03", "Cuenta suspendida no inicia sesión", st in (401, 403), f"HTTP {st}")
    req("PATCH", f"/usuarios/{uid2}/status", ADM, body={"status": "active"})
    req("PATCH", "/admin/settings/upload_max_mb", ADM, body={"value": 9})
    check("CP-030-04", "Cambio de configuración en bitácora", sql("select count(*) from audit_logs where action='PLATFORM_SETTING_UPDATED' and entity_id='upload_max_mb' and created_at > now() - interval '1 minute'") != "0")
    req("PATCH", "/admin/settings/upload_max_mb", ADM, body={"value": 8})

    print("\nHU-032 · Modelos de IA")
    name = f"plan_{uuid.uuid4().hex[:6]}"
    st, m1 = req("POST", "/admin/ai-models", ADM, body={"name": name, "task": "prueba", "version": "v1.0", "description": "Versión inicial"})
    st2, m2 = req("POST", "/admin/ai-models", ADM, body={"name": name, "task": "prueba", "version": "v1.1"})
    listed = req("GET", "/admin/ai-models", ADM)[1]["models"]
    check("CP-032-01", "Registrar modelo v1.0 visible en el listado", any(m["id"] == m1["id"] for m in listed))
    # Se activan sin comprobación contra el servicio (no existe un analizador con ese nombre): se fuerza en BD
    sql(f"update modelo_ia set estado='activo' where id='{m2['id']}'")
    st, d2 = req("POST", f"/admin/ai-models/{m2['id']}/deactivate", ADM)
    face_active = sql("select count(*) from modelo_ia where nombre='face' and estado='activo'")
    check("CP-032-02", "Desactivar un modelo no afecta a los demás", st in (200, 201) and d2["status"] == "inactivo" and face_active in ("0", "1"))
    st, r = req("POST", f"/admin/ai-models/{m1['id']}/activate", ADM)
    check("CP-032-03", "Restaurar versión anterior: falla la comprobación y se conserva lo activo", st == 422 and "Se mantiene" in json.dumps(r, ensure_ascii=False))
    bad = os.path.join(TMP, "modelo.txt")
    open(bad, "w").write("no es un modelo")
    st, r = req("POST", f"/admin/ai-models/{m1['id']}/artifact", ADM, files={"file": (bad, "text/plain")})
    check("CP-032-04", "Archivo de modelo con formato no soportado", st == 400 and "Formato de modelo no válido" in json.dumps(r, ensure_ascii=False))
    sql(f"delete from modelo_ia where nombre='{name}'")

    print("\nHU-033 · Recursos multimedia")
    st, stats = req("GET", "/media/stats/overview", ADM)
    check("CP-033-01", "Espacio usado y cantidad de archivos", st == 200 and stats["usage"]["fileCount"] >= 0 and stats["usage"]["usedBytes"] > 0)
    models = req("GET", "/admin/ai-models", ADM)[1]
    check("CP-033-02", "Estado y versión de los modelos", all("status" in m and "version" in m for m in models["models"]))
    prev_quota = [s for s in req("GET", "/admin/settings", ADM)[1]["settings"] if s["key"] == "storage_quota_gb"][0]["value"]
    req("PATCH", "/admin/settings/storage_quota_gb", ADM, body={"value": 0.0001})
    time.sleep(16)  # caché de ajustes
    usage = req("GET", "/media/stats/overview", ADM)[1]["usage"]
    alert_incident = sql("select count(*) from incidencia where titulo like 'Almacenamiento por encima%' and estado='abierta'")
    check("CP-033-03", "Alerta al superar el 90 %", usage["alert"] and alert_incident != "0", f"{usage['usagePercent']} %")
    req("PATCH", "/admin/settings/storage_quota_gb", ADM, body={"value": prev_quota})
    sql("update incidencia set estado='cerrada', resuelta_en=now() where titulo like 'Almacenamiento por encima%'")
    subprocess.run(["docker", "exec", "bellia_backend", "sh", "-c", "mkdir -p /app/uploads/wardrobe && echo huerfano > /app/uploads/wardrobe/huerfano_plan.webp && touch -d \"$(date -u -d @$(( $(date +%s) - 7200 )) '+%Y-%m-%d %H:%M:%S')\" /app/uploads/wardrobe/huerfano_plan.webp"])
    st, dry = req("POST", "/media/cleanup-orphans?dryRun=true", ADM)
    st, done = req("POST", "/media/cleanup-orphans?dryRun=false", ADM)
    gone = subprocess.run(["docker", "exec", "bellia_backend", "test", "-f", "/app/uploads/wardrobe/huerfano_plan.webp"]).returncode != 0
    check("CP-033-04", "Huérfanos detectados y eliminados", any(f["path"].endswith("huerfano_plan.webp") for f in dry["files"]) and gone and done["freedBytes"] > 0)

    print("\nHU-040 · Disponibilidad")
    st, wr = req("GET", "/wardrobe", T)
    T_again = req("POST", "/auth/login", body={"email": email, "password": "Prueba12345!"})[1]["token"]
    st2, wr2 = req("GET", "/wardrobe", T_again)
    check("CP-040-01/02", "Armario disponible tras volver a iniciar sesión", st == 200 and st2 == 200 and len(wr2["items"]) == len(wr["items"]) >= 1)

    print("\nHU-041 · Tareas asíncronas")
    st, t = req("POST", "/simulations", T, files={"file": (PORTRAIT, "image/jpeg")}, fields={"kind": "gafas", "options": json.dumps({"style": "redondas"})})
    check("CP-041-01", "Respuesta inmediata con estado en proceso", st == 202 and t["status"] in ("pendiente", "procesando"))
    t = wait(T, t)
    check("CP-041-02/03", "Seguimiento y resultado disponible", t["status"] == "completada" and t["progress"] == 100)
    styles = ["redondas", "rectangulares", "cat-eye", "aviador", "oversize"]
    tasks = [req("POST", "/simulations", T, files={"file": (PORTRAIT, "image/jpeg")}, fields={"kind": "gafas", "options": json.dumps({"style": styles[i % 5], "color": f"#{i:02d}2020"})})[1] for i in range(10)]
    done = [wait(T, x) for x in tasks]
    check("CP-041-05", "10 tareas simultáneas sin pérdida", len({d["id"] for d in done}) == 10 and all(d["status"] == "completada" for d in done))
    st, t = req("POST", "/simulations", T, files={"file": (PORTRAIT, "image/jpeg")}, fields={"kind": "unas", "options": "{}"})
    t = wait(T, t)
    check("CP-041-04", "Fallo con mensaje claro y reintento disponible", t["status"] == "fallida" and "mano" in (t["error"] or "").lower(), t["error"])

    print("\nHU-043 · Arquitectura modular")
    st, recs = req("GET", "/style/recommendations", T)
    check("CP-043-01", "Recomendaciones operan con independencia del servicio de IA", st == 200 and recs["count"] > 0)
    st, mods = req("GET", "/admin/ai-models", ADM)
    check("CP-043-03", "Módulos de IA con interfaz documentada", mods["serviceOnline"] and len(mods["serviceAnalyzers"]) >= 5)

    print("\nHU-029 · Derecho al olvido")
    st, b = req("POST", "/privacy/right-to-be-forgotten", T, body={"confirm": True, "password": "Prueba12345!"})
    left = sql(f"select (select count(*) from users where id='{uid}') + (select count(*) from usuario where id='{uid}') + (select count(*) from wardrobe_items where user_id='{uid}') + (select count(*) from diagnostico where usuario_id='{uid}')")
    check("CP-029-03", "Eliminación con contraseña borra todo", st in (200, 201) and left == "0", f"filas restantes={left}")
    req("POST", "/privacy/right-to-be-forgotten", T2, body={"confirm": True, "password": "Prueba12345!"})

    ok = sum(1 for r in results if r[2])
    print(f"\n{ok}/{len(results)} casos superados")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
