# DevOps Control Center — Descripción del proyecto

DevOps Control Center es un panel de control ligero diseñado para administrar proyectos, servicios y APIs en entornos Windows donde se utiliza PM2 para la gestión de procesos. Combina un frontend moderno en Next.js (App Router) con un backend en Node.js + Express y una base de datos SQL Server para almacenar la configuración de servicios, usuarios y metadatos de proyectos.

Este README está enfocado en describir qué hace el proyecto, su arquitectura, los flujos principales y cómo ponerlo en marcha en un entorno de desarrollo.

---

## Propósito

Proveer una interfaz centralizada para:

- Subir y versionar proyectos (con preservación de estructura y soporte para filtros tipo `.gitignore`).
- Gestionar procesos y servicios mediante PM2 (listar, arrancar, reiniciar, detener, eliminar).
- Proveer métricas básicas de APIs (latencia, disponibilidad, tamaño de respuesta) para monitoreo rápido.
- Administrar usuarios y permisos básicos para la interacción con la UI.

El producto está pensado para operaciones sencillas de DevOps en equipos pequeños o despliegues de laboratorio/QA en Windows con PM2.

---

## Arquitectura general

- Frontend: Next.js (App Router) + TypeScript. Componentes reutilizables y hooks para manejo de sesión.
- Backend: Node.js + Express. Rutas REST que exponen funcionalidad para proyectos, services, monitoring y users.
- Base de datos: Microsoft SQL Server (conexión mediante `mssql`) para persistencia de servicios, usuarios y metadatos de proyectos.
- Gestión de procesos: PM2 — el backend actúa en la capa de control para invocar acciones sobre procesos registrados.
- Sistema de archivos: almacenamiento de proyectos en disco bajo una carpeta configurada (versionado por carpeta con sufijos v1, v2, ...).

---

## Flujo y comportamientos clave

1. Subida de proyecto
	- El frontend envía un ZIP o conjunto de archivos al endpoint de proyectos.
	- El backend desempaqueta en un directorio temporal, aplica filtros de `.gitignore` (si se envían), normaliza nombres y copia los archivos aceptados a una nueva carpeta de versión.
	- Cada subida crea una nueva versión (v1, v2, ...). Existe soporte para descargar versiones como ZIP.

2. Versionado
	- Las versiones se organizan por carpetas con un esquema incremental.
	- El backend mantiene metadatos (fecha, autor, comentarios mínimos) en la BD o en registros locales según la implementación.

3. Gestión de servicios (PM2)
	- Los servicios se guardan como registros en la base de datos (nombre, script, args, entorno mínimo).
	- Desde la UI se pueden listar servicios, y enviar comandos de iniciar/reiniciar/detener/eliminar a través del backend que invoca PM2.

4. Monitoreo de APIs
	- Endpoints para consultar latencia, disponibilidad y tamaño de respuesta de APIs configuradas.
	- Dashboard rápido en el frontend con métricas agregadas y estado simple (OK / NOK).

5. Usuarios y autenticación
	- Autenticación básica (sesión local); el frontend incluye un hook `useCurrentUser` para centralizar la sesión y los permisos.
	- El sistema no implementa por defecto OAuth ni JWT en esta versión — es una capa de autenticación simple pensada para entornos controlados.

---

## Endpoints principales (resumen)

Nota: los paths pueden variar según la versión actual del backend; revisar `Backend/src/routes` para detalles.

- GET /api/monitoring — métricas de APIs.
- POST /api/projects/upload — subir proyecto / crear nueva versión.
- GET /api/projects/:id/download?v=VERSION — descargar ZIP de una versión.
- GET /api/services — listar servicios guardados.
- POST /api/services/:id/action — ejecutar acción sobre servicio (start/restart/stop/delete).
- POST /api/auth/login — autenticación básica de usuarios.
- CRUD /api/users — gestión de usuarios (protegida).

---

## Variables de configuración relevantes

Configurar variables en `Backend/.env` (o como prefieras) — ejemplo mínimo:

```
PORT=3001
DB_HOST=localhost
DB_NAME=YourDb
DB_USER=sa
DB_PASS=YourStrongPassword
PROJECTS_PATH=C:\ruta\a\proyectos
TEMP_UPLOADS=C:\ruta\a\tmp
```

Frontend:

```
NEXT_PUBLIC_API_BASE=http://localhost:3001/api
```

El backend centraliza las variables en `Backend/src/config/env.js` para su uso dentro de la aplicación.

---

## Cómo ejecutar (entorno de desarrollo, Windows - PowerShell)

1) Backend

```powershell
cd .\Backend
pnpm install   # o npm install
# crear .env con las variables mínimas
node src/server.js
```

2) Frontend

```powershell
cd ..\Frontend
pnpm install
pnpm dev
# abrir http://localhost:3000
```

Si el backend escucha en otro puerto, ajustar `NEXT_PUBLIC_API_BASE` en `Frontend/.env.local`.

---

## Consideraciones operativas y limitaciones

- Sistema de archivos: hoy el flujo de proyectos usa operaciones sincrónicas en algunos puntos (p. ej. `fs.*Sync`). Para producción se recomienda migrar a versiones asíncronas o streams para evitar bloqueo del event loop.
- Seguridad: la autenticación actual es básica. Para entornos reales conviene agregar HTTPS, tokens (JWT) o integración con un proveedor de identidad y una política de roles más estricta.
- Validación y límites: validar tamaños máximos de subida y usar límites de disco/espacio para evitar denegación de servicio por almacenamiento.
- PM2: las operaciones sobre PM2 requieren que el usuario que ejecuta el backend tenga permisos sobre PM2 en el host.
- Backup/versiones: si el historial de versiones es crítico, integrar almacenamiento remoto o backups periódicos.

---

## Mantenimiento y extensibilidad (lectura rápida para futuros cambios)

- Rutas del backend: `Backend/src/routes/*` — cada archivo contiene la lógica para su dominio (projects, services, users, auth, monitoring).
- Configuración: `Backend/src/config/env.js` centraliza rutas y credenciales (lee `.env`).
- Frontend: `Frontend/app` contiene las páginas y `Frontend/components` los componentes reutilizables; `Frontend/hooks/use-current-user.ts` centraliza la sesión.

Para agregar pruebas unitarias, las áreas prioritarias son: lógica de sanitización de nombres, filtrado `.gitignore` y movimiento de archivos.

---

## Roadmap corto (prioridades técnicas)

1. Reemplazar operaciones `fs.*Sync` por APIs asíncronas (prioridad alta).
2. Añadir middleware global de errores en Express para estandarizar respuestas y trazas.
3. Implementar un cliente HTTP en frontend (`lib/api/client.ts`) para manejo uniforme de errores y base URL.
4. Añadir logging estructurado (p. ej. `pino`) y métricas básicas en endpoints críticos.

---

## Licencia

MIT — ver archivo de licencia si está incluido en el repositorio.

---

Este README describe el propósito técnico, los flujos y las consideraciones principales para operar y extender DevOps Control Center en un entorno de desarrollo. Si quieres que adapte este README para un README de GitHub más comercial (con capturas, badges y ejemplos visuales), indícalo y lo preparo.
