# HU-023: Utilizar un avatar 3D para visualizar outfits (móvil)

**Estado en móvil:** 🟡 Parcial (falta probar el escaneo en un teléfono real) · Revisado el 18/11/2026

> El avatar 3D (three.js sobre expo-gl) sale de un **escaneo guiado** con las medidas reales de la usuaria. Sin escaneo, se usa el maniquí con las proporciones del análisis corporal. Los dos se giran con el dedo y se visten con outfits.

## Pantallas

- `AvatarScreen` (`/avatar`)
  - Avatar escaneado o procedural.
  - Tarjeta «Tus medidas» con «Repetir el escaneo» y «Borrar mi escaneo».
  - Banner «Escanea tu cuerpo» si todavía no hay escaneo.
- `AvatarScanScreen` (`/avatar-scan`): escaneo guiado con voz (expo-speech), texto grande y vibración. El escaneo tiene estos pasos:
  1. Estatura y consejos. Si falta el consentimiento de fotos, un botón «Autorizar».
  2. Cara con el teléfono en la mano: frente, izquierda, derecha, arriba y abajo, cada una con cuenta atrás.
  3. Apoyar el teléfono y alejarse unos 2,5 m (15 s). Después, una foto de prueba (`POST /api/avatar/scan/check`). Si se corta la cabeza o los pies, o la usuaria está muy lejos, la app lo dice en voz y vuelve a probar.
  4. Pose T, comprobada igual. Se repite si no se ve el cuerpo entero o si los brazos no están en T.
  5. Una vuelta despacio: hasta 16 fotos en 16 s.
  6. Subida y espera de la tarea. Al terminar vuelve a `/avatar`.

  La pantalla no se apaga durante el escaneo (expo-keep-awake).

## Archivos (relativos a `Movil/`)

- `src/screens/AvatarScreen.tsx`
- `src/screens/AvatarScanScreen.tsx`
- `src/app/avatar-scan.tsx`
- `src/features/bellai/ui/scannedAvatar.ts`: arma la malla escaneada. Las prendas son una capa sobre las regiones que cubren.
- `src/features/bellai/ui/avatarBuilder.ts`: maniquí procedural.
- `src/shared/lib/speech.ts`: voz. Si la app se compiló sin expo-speech, sigue sin voz.
- Cliente de la API: `src/features/bellai/api/bellaiApi.ts` (`avatarApi.scan`, `mesh` y `removeScan`).

## Endpoints que usa

- `GET/POST /api/avatar`
- `POST /api/avatar/scan`
- `POST /api/avatar/scan/check`
- `GET /api/avatar/mesh`
- `DELETE /api/avatar/scan`
- `GET /api/avatar/outfit/:id`

## Dependencias nuevas

- `expo-speech ~58.0.4`: módulo nativo, hay que recompilar la app.
- `expo-keep-awake ~58.0.3`: ya venía dentro de `expo`; ahora es una dependencia directa.

## Qué se probó

- `tsc` y ESLint limpios.
- Backend e IA con tests (ver el documento de Frontend_Backend).

## Qué falta

- Probar el escaneo completo en un teléfono real.

Detalle de backend, IA y criterios de prueba: [documento de Frontend_Backend](../../../../Frontend_Backend/docs/CasosDeUsos/HU-023-avatar-3d/README.md).

[← Volver al índice](../README.md)
