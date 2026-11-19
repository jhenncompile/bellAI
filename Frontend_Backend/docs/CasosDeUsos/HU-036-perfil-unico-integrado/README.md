# HU-036: Integrar los resultados faciales, corporales y colorimétricos en un perfil único

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Alta |
| Razón (PDF) | Utilizar una visión integral de la usuaria para generar recomendaciones personalizadas |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |
| Backlog v2 | **HU-12**: integrar rostro (HU-08), piel (HU-09) y silueta (HU-11) en el resumen del diagnóstico |

## Situación actual

`diagnosis.builder.ts` une los tres análisis en un diagnóstico con confianza global y recomendaciones combinadas.

## Cómo funciona

1. Cada analizador devuelve su resultado con confianza.
2. Si la usuaria solo envía una foto, `mergeAnalyses` completa la otra parte con su último diagnóstico (lo nuevo siempre sustituye a lo anterior).
3. El builder los combina en un solo resultado (resumen, confianza global, recomendaciones) y se guarda en `diagnostico` de su cuenta.
4. La app móvil lo pide con `POST /api/diagnosis` y lo recupera con `GET /api/diagnosis/latest`.

## Implementación

**Endpoints**

- `POST /api/diagnosis`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/diagnosis/diagnosis.builder.ts`
- `backend/src/modules/diagnosis/diagnosis.service.ts`

**Tablas**

`diagnostico`

## Pruebas y criterios de aceptación

- Jest `diagnosis/diagnosis.spec.ts`: unión de las tres partes, completar con el diagnóstico anterior en ambos sentidos y no inventar la parte que falta.

## Qué falta o limitaciones

- Si falta la foto de cuerpo, el perfil se arma solo con rostro y color.

## Plataformas

- Móvil: no aplica (historia de administración o de sistema sin pantalla propia).
- Panel web: no aplica.

[← Volver al índice](../README.md)
