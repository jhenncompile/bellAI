# Casos de uso en la app móvil

Historias de usuario del *Perfil de proyecto* que tienen parte en la app móvil (Expo SDK 58). Revisado el 15/11/2026.
La parte de servidor, IA y criterios de prueba de cada historia está en `Frontend_Backend/docs/CasosDeUsos/`.

| HU | Historia | Pantalla principal | Estado |
|---|---|---|---|
| [HU-001](./HU-001-perfil-y-preferencias/README.md) | Gestionar mi perfil y preferencias de estilo | Perfil (`src/app/(tabs)/profile.tsx` → `src/screens/ProfileScreen.tsx`) | 🟢 Completa |
| [HU-002](./HU-002-analisis-facial/README.md) | Analizar las características de mi rostro mediante fotografías | Inicio → «Tomar otra fotografía» (cámara guiada, modo Rostro) | 🟢 Completa |
| [HU-003](./HU-003-analisis-corporal/README.md) | Analizar mis proporciones corporales mediante fotografías | Cámara guiada, pestaña «Cuerpo» | 🟡 Parcial |
| [HU-004](./HU-004-tono-y-subtono-de-piel/README.md) | Analizar mi tono y subtono de piel | Mi análisis | 🟢 Completa |
| [HU-005](./HU-005-diagnostico-integral/README.md) | Consultar mi diagnóstico integral de imagen | Mi análisis (`StudioScreen`) | 🟢 Completa |
| [HU-006](./HU-006-paleta-personalizada/README.md) | Consultar mi paleta personalizada de colores | Mi análisis | 🟢 Completa |
| [HU-007](./HU-007-perfil-de-estilo/README.md) | Obtener un perfil de estilo personalizado | Style DNA (`src/app/style.tsx` → `StyleScreen`) | 🟢 Completa |
| [HU-008](./HU-008-style-dna/README.md) | Consultar mi Style DNA | Style DNA (`StyleScreen`) | 🟢 Completa |
| [HU-009](./HU-009-registrar-armario/README.md) | Registrar y organizar mi armario digital mediante fotografías | Armario (`src/app/(tabs)/wardrobe.tsx` → `WardrobeScreen`) | 🟢 Completa |
| [HU-010](./HU-010-reconocer-prendas/README.md) | Reconocer automáticamente las características de mis prendas | Confirmación de prenda (`CU19ConfirmGarmentView`) | 🟢 Completa |
| [HU-011](./HU-011-consultar-armario/README.md) | Consultar las prendas disponibles en mi armario | Armario (`CU20WardrobeView`) | 🟢 Completa |
| [HU-012](./HU-012-recomendaciones-de-prendas/README.md) | Recibir recomendaciones de prendas según mi perfil | Style DNA / recomendaciones (`StyleScreen`) | 🟢 Completa |
| [HU-013](./HU-013-colores-cortes-escotes-accesorios/README.md) | Recibir recomendaciones de colores, cortes, escotes y accesorios | `StyleScreen` | 🟢 Completa |
| [HU-014](./HU-014-recomendaciones-explicadas/README.md) | Obtener recomendaciones explicadas | `StyleScreen` | 🟢 Completa |
| [HU-015](./HU-015-generar-outfits/README.md) | Generar outfits personalizados utilizando mi armario | Outfits (`src/app/outfits.tsx` → `OutfitsScreen`) | 🟢 Completa |
| [HU-016](./HU-016-outfits-por-ocasion-clima-presupuesto/README.md) | Solicitar outfits según ocasión, clima, preferencias y presupuesto | `OutfitsScreen` | 🟢 Completa |
| [HU-017](./HU-017-comparar-outfits/README.md) | Comparar diferentes propuestas de outfit | `OutfitsScreen` (comparar) | 🟢 Completa |
| [HU-018](./HU-018-guardar-y-valorar-outfits/README.md) | Guardar y valorar outfits recomendados | `OutfitsScreen` | 🟢 Completa |
| [HU-019](./HU-019-cambios-de-cabello-y-color/README.md) | Visualizar cambios virtuales de cabello y color | Probador virtual (`src/app/simulator.tsx` → `SimulatorScreen`) | 🟡 Parcial |
| [HU-020](./HU-020-maquillaje-y-unas/README.md) | Visualizar propuestas virtuales de maquillaje y uñas | `SimulatorScreen` | 🟢 Completa |
| [HU-021](./HU-021-probar-gafas/README.md) | Visualizar diferentes tipos de gafas sobre mi imagen | `SimulatorScreen` | 🟢 Completa |
| [HU-022](./HU-022-probador-de-prendas/README.md) | Utilizar un probador virtual de prendas y outfits | Probador virtual → «Prendas» (`SimulatorScreen`) | 🟢 Completa |
| [HU-023](./HU-023-avatar-3d/README.md) | Utilizar un avatar 3D para visualizar outfits | `AvatarScreen` | 🟢 Completa |
| [HU-024](./HU-024-evaluar-prenda-con-camara/README.md) | Evaluar una prenda mediante la cámara | ¿Me lo compro? (`src/app/compatibility.tsx` → `CompatibilityScreen`) | 🟢 Completa |
| [HU-025](./HU-025-motivo-de-compatibilidad/README.md) | Consultar el nivel y motivo de compatibilidad de una prenda | `CompatibilityScreen` | 🟢 Completa |
| [HU-026](./HU-026-asistente-inteligente/README.md) | Consultar al asistente inteligente sobre moda, imagen y estilo | Asistente (`src/app/(tabs)/advisor.tsx` → `ChatAdvisorScreen`) | 🟢 Completa |
| [HU-027](./HU-027-recomendaciones-de-compra/README.md) | Consultar recomendaciones relacionadas con compras | `CompatibilityScreen` | 🟢 Completa |
| [HU-028](./HU-028-historial/README.md) | Consultar mi historial de recomendaciones, simulaciones y elecciones | Historial (`src/app/history.tsx` → `HistoryScreen`) | 🟢 Completa |
| [HU-029](./HU-029-privacidad-de-datos/README.md) | Gestionar mis datos y preferencias de privacidad | Perfil → Privacidad (`CU11PrivacyDataView`) | 🟢 Completa |
| [HU-031](./HU-031-gestionar-incidencias/README.md) | Gestionar incidencias reportadas por las usuarias | Reportar un problema (`src/app/report.tsx` → `ReportScreen`) | 🟢 Completa |
| [HU-034](./HU-034-proteger-informacion-sensible/README.md) | Procesar y proteger localmente la información sensible | Transversal (sin pantalla propia) | 🟢 Completa |
| [HU-035](./HU-035-validar-fotografias/README.md) | Validar las condiciones de las fotografías antes de realizar análisis | Cámara guiada (guía de ojos y barbilla, consejos de luz) | 🟢 Completa |
| [HU-038](./HU-038-clima-ocasion-preferencias/README.md) | Incorporar clima, ocasión y preferencias al generar outfits | `OutfitsScreen` | 🟢 Completa |
| [HU-039](./HU-039-aprender-de-valoraciones/README.md) | Aprender de las valoraciones y elecciones de la usuaria | Botones de valoración en `StyleScreen` y `OutfitsScreen` | 🟢 Completa |
| [HU-040](./HU-040-disponibilidad-armario-perfil-historial/README.md) | Mantener disponible el armario, perfil e historial | Armario (caché sin conexión) | 🟢 Completa |
| [HU-041](./HU-041-tareas-asincronas/README.md) | Procesar las tareas de visión artificial y renderizado 3D de forma asíncrona | Transversal (diagnóstico y simulaciones) | 🟢 Completa |
| [HU-042](./HU-042-explicaciones-con-ia/README.md) | Generar explicaciones comprensibles a partir de los resultados de IA | Botón «Explícamelo» en las tarjetas | 🟢 Completa |

## Navegación

- Pestañas (`src/app/(tabs)/`): Inicio, Armario, Mi análisis (`studio`), Asistente (`advisor`) y Perfil.
- Pantallas secundarias en el Stack raíz (`src/app/`): `style`, `outfits`, `compatibility`, `simulator`, `history`, `report`, `avatar`, `challenge`, `explore`.

## Vistas `CUxx` sin conectar

Las vistas `CU05`, `CU06`, `CU08`, `CU09`, `CU10` y `CU12` a `CU17` de `src/views/` existen, pero ninguna ruta las usa. Esas funciones se cubren con `ProfileScreen` (`CU07`, `CU11`), `GuidedCameraModal` y `StudioScreen`. Hay que decidir si se conectan o se eliminan.

## Probado en dispositivo real

Galaxy S22 (Android) el 15/11/2026: instalación, inicio de sesión, cámara real y validación de la foto. Pendiente: diagnóstico completo con buena luz, foto de cuerpo entero y semáforo con una prenda real.
