# HU-022: Utilizar un probador virtual de prendas y outfits

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Experimentar visualmente con diferentes prendas antes de decidir utilizarlas o adquirirlas |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Dos formas de probar: una prenda del armario sobre la foto de la usuaria (2D, guiada por el Pose Landmarker) y outfits completos sobre el avatar 3D (HU-023).

## Cómo funciona

1. En el Probador la usuaria elige «Prendas», su foto de frente y una prenda del armario.
2. El backend comprueba que la prenda es suya, deduce la región (superior, inferior o completo) y lanza una tarea asíncrona.
3. El servicio de IA detecta hombros, caderas, rodillas y tobillos, recorta la prenda de su fondo (GrabCut) y la ajusta con una transformación de perspectiva.
4. Se conservan las sombras grandes de la foto y los antebrazos que quedan delante del cuerpo.
5. Para outfits completos, el avatar 3D se viste con las prendas del outfit.

## Implementación

**Endpoints**

- `GET /api/simulations/options` (incluye `garment.items`)
- `POST /api/simulations` (`kind=prenda`, `options.garmentId`) → 202
- `GET /api/avatar/outfit/:id`
- Servicio de IA: `POST /api/v1/simulate/prenda` (`file` + `garment`)

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/ai/app/analyzers/simulation.py`
- `backend/src/modules/simulations/simulations.service.ts`
- `backend/src/modules/simulations/avatar.service.ts`
- `backend/ai/tests/test_tryon.py`
- `backend/src/modules/simulations/simulations.spec.ts`

**Tablas**

`simulacion`, `wardrobe_items`, `tarea`

## Pruebas y criterios de aceptación

- pytest `test_tryon.py`: prenda superior, inferior y completa sobre una foto real de cuerpo entero (dominio público), cabeza sin tapar y mensajes de error claros.
- Jest `simulations.spec.ts`: región según la categoría; calzado y accesorios no se prueban.

## Qué falta o limitaciones

- Es una vista aproximada en 2D: no simula la caída de la tela ni prendas con mangas largas sobre brazos levantados.
- Calzado y accesorios no se pueden probar sobre la foto.
- No hay una versión generativa (requeriría un modelo de difusión; ver HU-019).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-022-probador-de-prendas/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
