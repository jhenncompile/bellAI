# HU-023: Utilizar un avatar 3D para visualizar outfits

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Representar mis proporciones y visualizar combinaciones completas de manera interactiva |
| Planificación | Product Backlog (sin sprint asignado en el documento) |
| Estado | **🟡 Parcial**: el escaneo está hecho y probado con fotos de prueba, pero falta probarlo con un escaneo real en un teléfono |
| Revisado | 18/11/2026 |

## Situación actual

Hay dos avatares:

- **Escaneado (nuevo).** La app guía a la usuaria con voz, texto y vibración para hacer un escaneo. El servidor mide su cuerpo y arma una malla 3D con sus medidas reales en centímetros, con la cara sacada de su foto.
- **Procedural (respaldo).** Maniquí con las proporciones del análisis corporal, para quien no se escanea.

Los dos se giran con el dedo y se visten con los outfits guardados.

## Cómo funciona el escaneo

1. **Cara, con el teléfono en la mano.** La app toma 5 fotos con la cámara frontal: de frente, girando la cabeza a la izquierda y a la derecha, con la barbilla arriba y con la barbilla abajo.
2. **Teléfono apoyado.** La usuaria apoya el teléfono de pie y se aleja unos 2,5 m. Hay 15 s de cuenta atrás.
3. **Pose T.** Una foto de cuerpo entero con los brazos en cruz.
4. **Giro.** La usuaria da una vuelta despacio y la app toma hasta 16 fotos en 16 s.
5. **Subida.** Las fotos se reducen a 960 px (cara y pose T) y a 720 px (giro), y se envían a `POST /api/avatar/scan` con la estatura.
6. **Tarea `avatar_escaneo`.** La API encola la tarea, con 240 s de margen como mínimo. La tarea:
   - llama a `POST /api/v1/avatar/reconstruct` del servicio de IA;
   - guarda la malla (JSON) en `private/{usuario}/avatar/escaneo-*.json`;
   - deja las medidas en `avatar.configuracion.scan`;
   - **borra siempre las fotos**, también si falla.
7. Al terminar llega un push: «Tu avatar 3D está listo». Al tocarlo se abre `/avatar`.

### Qué mide el servicio de IA (`backend/ai/app/analyzers/avatar_scan.py`)

- **Escala.** La silueta de la pose T (segmentación de MediaPipe Pose) mide lo mismo que la estatura indicada. Eso da los centímetros por píxel. Las alturas de cadera, rodilla y hombro salen de los puntos del cuerpo.
- **Contornos de pecho, bajo busto, cintura y cadera.**
  - En cada foto del giro se mide el ancho del torso sin brazos (los brazos se quitan con SegFormer).
  - El ángulo de giro sale de los puntos 3D de MediaPipe (el vector entre hombros y caderas).
  - Para una sección elíptica, `(W/2)² = a²·cos²θ + b²·sin²θ`. Se ajustan los semiejes `a` y `b` por mínimos cuadrados y el contorno se calcula con la fórmula de Ramanujan.
  - Si el giro no cubre al menos unos 35°, la profundidad es estimada y se avisa.
- **Brazos y piernas.** El grosor se mide en la silueta de la pose T y los largos salen de los puntos del cuerpo.
- **Cara.**
  - Malla de 468 puntos y 852 triángulos de MediaPipe Face Landmarker.
  - Se pasa a metros con la distancia entre pupilas, que se toma como 6,2 cm.
  - La profundidad se corrige con las vistas giradas: un punto girado θ se ve en `x' = x·cosθ + z·sinθ`.
  - Los colores salen de la foto.
- **Malla final** (`avatar_mesh.py`, solo numpy).
  - Cuerpo hecho de secciones elípticas con las medidas, casco de cabeza ajustado al óvalo de la cara y melena según el largo del cabello.
  - Unos 3000 vértices y 220 KB de JSON.
  - Cada vértice lleva una región (`rostro`, `torso`, `pelvis`, `muslo`…). Con ellas la app pone las prendas como una capa sobre la piel.
- Tarda unos 3 s por escaneo en CPU.

Si algo sale mal (no se ve el cuerpo entero, no hay cara, la estatura no es válida), el servicio responde 422 con `{code, message}` en español. Ese mensaje es el que ve la usuaria.

## Implementación

**Endpoints**

- `GET /api/avatar`: configuración. Si hay escaneo, añade `scan` con `measurements`, `quality`, `appearance` y `createdAt`, y `source: 'escaneo'`.
- `POST /api/avatar`: personalización del avatar procedural. Se fusiona con el escaneo y no lo borra.
- `POST /api/avatar/scan` (multipart): `face_frente`, `face_izquierda`, `face_derecha`, `face_arriba`, `face_abajo`, `tpose`, `turn_0`…`turn_23` y `height_cm`. Responde 202 con la tarea. Exige el consentimiento `photo_analysis`.
- `POST /api/avatar/scan/check` (campo `file`): comprobación rápida y síncrona de si se ve el cuerpo entero. Devuelve `{ok, code, message, tpose}`, con los códigos `sin_persona`, `cabeza_cortada`, `pies_cortados` y `muy_lejos`. La foto no se guarda. La app la usa al terminar de colocarse y después de la pose T, y repite la foto con la indicación en voz. Si aun así la pose T no sirve, el servidor usa la foto del giro más de frente y avisa.
- `GET /api/avatar/mesh`: malla del último escaneo.
- `DELETE /api/avatar/scan`: borra la malla y las medidas.
- `GET /api/avatar/outfit/:id`
- Servicio de IA: `POST /api/v1/avatar/reconstruct` y `POST /api/v1/avatar/check-body`.

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/simulations/avatar.service.ts`
- `backend/src/modules/simulations/avatar-scan.service.ts`
- `backend/src/modules/tasks/tasks.service.ts`: tiempo mínimo por tipo de tarea.
- `backend/src/modules/notifications/push.messages.ts`
- `backend/src/modules/privacy/privacy.service.ts`: al borrar la cuenta se borra también la malla.
- `backend/ai/app/analyzers/avatar_scan.py`
- `backend/ai/app/analyzers/avatar_mesh.py`
- `backend/ai/app/api/v1/endpoints/avatar.py`

**Tablas**

- `avatar`: las medidas van en `configuracion.scan`, el JSONB que ya existía.
- `fotografia`: fotos de tipo `avatar`, que son temporales.
- No hay cambios de esquema.

## Pruebas y criterios de aceptación

- `backend/ai/tests/test_avatar_scan.py`: 10 tests.
  - Ajuste de la elipse y contorno.
  - Triángulos de la cara.
  - Normales hacia fuera.
  - Reconstrucción con las fotos de `tests/fixtures`.
  - Errores 422.
- `backend/src/modules/simulations/avatar-scan.spec.ts`: 9 tests.
  - Validación de la subida y consentimiento.
  - Malla guardada y borrado de la anterior.
  - Las fotos se borran aunque falle la IA.
  - Push.
- Con las fotos de prueba (sin giro ni pose T reales) el avatar sale con cintura 73 cm y cadera 100 cm para 165 cm de estatura. La respuesta avisa de que la profundidad es estimada.

## Qué falta o limitaciones

- **Falta probarlo con un escaneo real en un teléfono.** Las fotos de prueba no tienen giro ni pose T.
- **Hay que recompilar la app** (`npx expo run:android`) para tener voz: `expo-speech` es un módulo nativo. Sin recompilar, el escaneo funciona solo con texto y vibración.
- **La malla es paramétrica.** Las medidas son reales, pero el cuerpo se arma con secciones elípticas, no con un escaneo denso. La ropa holgada infla los contornos; por eso se pide ropa ajustada.
- **La cara solo se ve bien de frente.** El cráneo es un elipsoide y el cabello se reduce a casco más melena.

## Plataformas

- Móvil: **🟡 Parcial** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-023-avatar-3d/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
