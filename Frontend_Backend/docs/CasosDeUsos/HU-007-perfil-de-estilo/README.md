# HU-007: Obtener un perfil de estilo personalizado

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Contar con una representación de mis preferencias y características estéticas |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 18/11/2026 |
| Backlog v2 | **HU-13: Conocer mi perfil de estilo** (depende de HU-02 y HU-12) |

## Situación actual

Perfil de estilo con 7 dimensiones (elegancia, minimalismo, romanticismo, naturalidad, dramatismo, clasicismo, experimentalidad) y los estilos más cercanos.

## Cómo funciona

1. Se combinan cuatro fuentes: lo declarado (HU-001, pesa más), lo inferido del diagnóstico, **el armario** y las valoraciones (HU-039).
2. **Armario (HU-13):** cada prenda confirmada aporta su ADN (`garmentDna`: tipo + estilos que vio la IA en la foto); las que más usa pesan hasta el triple. Cuenta desde 3 prendas y su peso crece con el número de prendas (tope 0,3), sin superar nunca a lo declarado.
3. Se devuelven las dimensiones (0–100), las 3 predominantes, los estilos más cercanos y **cuánto aporta cada fuente** (`contributions`, suma 100).
4. **Evolución (HU-13):** cada cambio real del perfil guarda un punto en `perfil_dna_historial` con su motivo (`creacion`, `preferencias`, `diagnostico`, `armario`, `valoraciones`). Cambios seguidos por el mismo motivo se funden durante 30 min. Si las dimensiones no cambiaron respecto al último punto no se guarda nada, y la escritura va con un bloqueo por usuaria (`pg_advisory_xact_lock`) porque la app pide perfil y recomendaciones a la vez. Al leer, los puntos seguidos idénticos se funden (`collapseHistory`) y solo cuentan como predominantes las dimensiones que superan 55 (`predominantDimensions`); un punto neutro sale sin ellas. `evolution` devuelve las dimensiones que más se movieron en 90 días y los últimos puntos.
5. Sin ninguna fuente el perfil es neutro: `hasData: false` y no se devuelven dimensiones predominantes.

## Implementación

**Endpoints**

- `GET /api/style/dna`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/style/style-dna.ts`
- `backend/src/modules/style/style.service.ts`

**Tablas**

`preferences`, `perfil_dna`, `perfil_dna_historial`, `retroalimentacion`

## Pruebas y criterios de aceptación

- Jest `style.spec.ts` (incluye HU-13: pesos de las fuentes, armario, motivo del cambio, comparación independiente del orden de claves del JSONB, historial sin puntos repetidos y perfil neutro sin dimensiones predominantes).
- Prueba en vivo (18/11/2026, cuenta temporal ya borrada): al declarar estilos el perfil pasa de neutro a minimalismo/elegancia/clasicismo (100 % preferencias); tras 3 valoraciones las valoraciones aportan el 19 % y el historial muestra los tres cambios con su motivo. Perfil y recomendaciones pedidos a la vez dejan un solo punto. El diagnóstico se cubrió solo con Jest (servicio de IA apagado).
- CP-001-03/04 del plan de pruebas.

## Qué falta o limitaciones

- Nada pendiente detectado.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-007-perfil-de-estilo/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
