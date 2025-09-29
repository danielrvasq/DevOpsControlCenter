# DevOps Control Center (CSM)

DevOps Control Center es una plataforma desarrollada para el área de TI de Cementos San Marcos (CSM).  
Su objetivo es almacenar, administrar y llevar registro de los proyectos de software, con funciones de monitoreo de APIs, gestión de servicios vía PM2, y control de acceso por roles (Admin, Developer, Viewer).

---

## Características principales

- Gestión de proyectos con versiones, historial y descargas en ZIP.
- Monitoreo de APIs externas (disponibilidad, tiempo de respuesta, payload size).
- Gestión de servicios con PM2 (start, stop, restart, listado de procesos).
- Manejo de usuarios con roles y permisos diferenciados:
  - Admin -> control total (usuarios, proyectos, servicios, configuración).
  - Developer -> proyectos, subida de código, monitoreo y control de servicios.
  - Viewer -> solo lectura (estado de servicios, consulta de proyectos).

---

## Tecnologías utilizadas

- Backend: Node.js, Express.js, SQL Server, PM2  
- Frontend: React  
- Base de datos: Microsoft SQL Server  
- Otros: multer, archiver, ignore (.gitignore), dotenv, cors  

---

## Estructura del proyecto

## Instalacion y configuración 

cd backend
npm install

PORT=3001
DB_HOST=localhost
DB_NAME=DevOpsControlCenter
DB_USER=usuario
DB_PASS=contraseña

npm run dev

## Configuración frontend

cd frontend
npm install
npm run dev

## Endpoints principales
## Autenticación

POST /api/login -> autentica usuario ({ username, password }).

## Usuarios

GET /api/users -> lista usuarios.

GET /api/users/:id -> detalle de usuario.

POST /api/users -> crear usuario.

PUT /api/users/:id -> actualizar usuario.

DELETE /api/users/:id -> eliminar usuario.

## Proyectos

GET /api/projects -> lista proyectos (última versión).

POST /api/upload -> subir proyecto/versión (multipart).

GET /api/projects/:id/versions -> historial de versiones.

GET /api/projects/:id/versions/:version/download -> descargar ZIP.

DELETE /api/projects/:id -> eliminar proyecto.

## APIs

POST /api/apis -> registrar API.

DELETE /api/apis/:id -> eliminar API.

GET /api/monitor/apis -> monitoreo de APIs registradas.

## Servicios (PM2)

GET /api/services/list -> lista de servicios en PM2.

POST /api/services/:accion/:name -> ejecutar acción (start|stop|restart).

## Roles y permisos

Admin -> Control total, gestión de usuarios, servicios, proyectos.
Developer -> Gestión de proyectos, subida de código, control de servicios, monitoreo.
Viewer -> Solo lectura (consultar proyectos y servicios).


