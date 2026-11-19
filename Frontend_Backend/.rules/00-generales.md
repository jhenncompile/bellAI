# Reglas generales

Aplican a todo el repositorio.

## Idioma

1. Escribe en **español** la UI, los comentarios, los mensajes de error visibles, la documentación y los mensajes de commit.
2. Mantén en inglés solo lo que ya lo está: nombres técnicos de React/NestJS, tipos y APIs de librerías.
3. Los nombres de dominio siguen al backend: `usuarios`, `perfil`, `privacidad`, `consentimientos`.

## Alcance de los cambios

4. Haz lo que se pide y nada más. No "aproveches para" reformatear, renombrar o migrar archivos que no están en el encargo.
5. Si una tarea necesita un cambio de contrato de API, cambia **las dos puntas** en el mismo trabajo: el controlador de `backend/src/modules/...` y el `service` de la feature del frontend.
6. Antes de dar algo por terminado, ejecútalo. En el frontend: `pnpm build` como mínimo.
7. Si encuentras un problema fuera del encargo, **anótalo** en tu respuesta o en `AGENTS.md`; no lo arregles por tu cuenta.

## Lo que no se hace

8. **No commitees ni abras Pull Requests** si no te lo han pedido explícitamente.
9. No metas secretos reales en el repositorio. `docker-compose.yml` tiene credenciales de clase en claro a propósito: no las uses como plantilla para nada que salga de aquí, y no añadas más.
10. No añadas dependencias nuevas sin decirlo y justificarlo. Este es un proyecto de materia: cada librería nueva es algo que el grupo tiene que mantener y defender.
11. No borres ni reescribas `AGENTS.md`, `.rules/` ni los archivos de enganche para "limpiar". Si una regla ya no aplica, cámbiala con un motivo.
12. No inventes el estado del proyecto. Antes de afirmar que algo funciona, compruébalo: la sección "Estado real" de `AGENTS.md` existe porque el `README.md` llevaba meses describiendo cosas que no existían.

## Arranque rápido

```bash
docker compose up -d                 # todo el sistema
docker compose up -d postgres redis  # solo infraestructura
cd backend  && npm install && npm run dev    # API  -> :8000/api
cd Frontend && pnpm install && pnpm dev      # SPA  -> :5173
```

13. `iniciar.ps1` y `PROYECTO_CONTROL.cmd` son **solo para Windows**. En Linux/macOS usa `docker compose`.
14. Credenciales de demostración: `valeria@bellia.com` / `123456789`. No inventes otras en la documentación.
