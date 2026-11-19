"""Prueba de integración: lo incorporado desde main (historial unificado, explicación de recomendaciones,
conversación) y el probador de prendas sobre la foto (HU-022), contra el sistema levantado.

    BELLAI_API=http://localhost:8000/api backend/ai/.venv/bin/python backend/tests/e2e/integracion.py

Crea una usuaria de prueba con una prenda y la elimina al final.
"""
import json
import os
import sys
import time
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan_de_pruebas import API, check, garment_image, image, register, req, results, wait  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
BODY = os.path.abspath(os.path.join(HERE, "..", "..", "ai", "tests", "fixtures", "cuerpo_completo.jpg"))
PORTRAIT = os.path.abspath(os.path.join(HERE, "..", "..", "ai", "tests", "fixtures", "retrato.jpg"))


def main():
    T, uid, _ = register("Integración")
    req("POST", "/privacy/consents", T, body={"consentType": "photo_analysis", "accepted": True})

    print("\nHU-022 · Probador de prendas sobre la foto")
    blusa = garment_image("blusa_roja.jpg", (60, 60, 200))
    st, scan = req("POST", "/wardrobe/scan", T, files={"photo": (blusa, "image/jpeg")}, fields={"name": "Blusa roja"})
    item = (scan or {}).get("item", {})
    if item.get("category") != "superior":
        req("PATCH", f"/wardrobe/{item['id']}", T, body={"category": "superior", "subcategory": "blusas"})
    st, opts = req("GET", "/simulations/options", T)
    ids = [g["id"] for g in opts.get("garment", {}).get("items", [])]
    check("HU-022", "La prenda aparece en las opciones del probador", item.get("id") in ids, f"{len(ids)} prendas")
    st, task = req("POST", "/simulations", T, files={"file": (BODY, "image/jpeg")},
                   fields={"kind": "prenda", "options": json.dumps({"garmentId": item["id"]})})
    check("HU-022", "Respuesta inmediata (202)", st == 202, f"HTTP {st}")
    task = wait(T, task)
    res = task.get("result") or {}
    check("HU-022", "Prenda colocada sobre la foto", task["status"] == "completada" and res.get("meta", {}).get("region") == "superior"
          and len(res.get("imageBase64", "")) > 1000, task.get("error") or res.get("meta"))
    st, b = req("POST", "/simulations", T, files={"file": (BODY, "image/jpeg")},
                fields={"kind": "prenda", "options": json.dumps({"garmentId": str(uuid.uuid4())})})
    check("HU-022", "Prenda ajena o inexistente: 404", st == 404, f"HTTP {st}")
    st, b = req("POST", "/simulations", T, files={"file": (BODY, "image/jpeg")}, fields={"kind": "prenda", "options": "{}"})
    check("HU-022", "Sin prenda elegida: 400 con mensaje", st == 400 and "armario" in json.dumps(b, ensure_ascii=False), f"HTTP {st}")

    print("\nIncorporado desde main · /api/bellai")
    t = wait(T, req("POST", "/diagnosis", T, files={"face": (PORTRAIT, "image/jpeg")})[1])
    st, conv = req("POST", "/assistant/conversations", T, body={"title": "Prueba de integración"})
    req("POST", f"/assistant/conversations/{conv['id']}/messages", T, body={"content": "¿Qué colores me favorecen?"})
    st, hist = req("GET", "/bellai/history", T)
    types = {h["type"] for h in hist} if isinstance(hist, list) else set()
    check("main", "Historial unificado con diagnóstico y consulta", st == 200 and {"diagnostic", "consultation"} <= types, str(types))
    st, ex = req("POST", "/bellai/recommendations/explain", T, body={"recommendationType": "color", "colors": ["Coral"]})
    check("main", "Explicación de recomendación con datos reales", st in (200, 201) and ex.get("basedOnRealData") is True and ex.get("reasonSummary"))
    st, c = req("GET", f"/bellai/conversations/{conv['id']}", T)
    check("main", "Conversación con roles user/assistant", st == 200 and {m["role"] for m in c["messages"]} == {"user", "assistant"})
    st, item_d = req("GET", f"/bellai/history/diagnostic/{t['result']['id'] if t.get('result') else uuid.uuid4()}", T)
    check("main", "Detalle de un diagnóstico del historial", st == 200 and item_d.get("type") == "diagnostic", f"HTTP {st}")
    st, _ = req("DELETE", f"/bellai/history/consultation/{conv['id']}", T)
    st2, _ = req("GET", f"/bellai/conversations/{conv['id']}", T)
    check("main", "Borrar una consulta del historial", st in (200, 201) and st2 == 404, f"DELETE {st}, GET {st2}")
    st, _ = req("GET", f"/bellai/history/otro/{uuid.uuid4()}", T)
    check("main", "Tipo de historial inválido: 400", st == 400)

    req("POST", "/privacy/right-to-be-forgotten", T, body={"confirm": True, "password": "Prueba12345!"})
    ok = sum(1 for r in results if r[2])
    print(f"\n{ok}/{len(results)} comprobaciones superadas")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
