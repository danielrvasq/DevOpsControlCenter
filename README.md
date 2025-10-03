# Documentación Técnica — Backend DevOps Control Center

Este documento describe el funcionamiento técnico del backend de **DevOps Control Center**, incluyendo su arquitectura, dependencias, flujo de ejecución y detalle de los módulos principales.

---

## 1. Arquitectura general

El backend está desarrollado en **Node.js** con **Express.js** y utiliza **SQL Server** como base de datos.  
El sistema sigue una arquitectura modular: cada funcionalidad (usuarios, proyectos, APIs, servicios) se implementa en un **router independiente** dentro de la carpeta `routes/`.

### Diagrama de módulos

server.js
├── routes/
│ ├── auth.js -> Autenticación de usuarios
│ ├── users.js -> CRUD de usuarios
│ ├── projects.js -> Gestión de proyectos y versiones
│ ├── apis.js -> Registro y monitoreo de APIs
│ └── services.js -> Gestión de servicios vía PM2
└── ...

---

## 2. Dependencias principales

- **express** -> framework web para definir rutas y middlewares.  
- **cors** -> habilita solicitudes desde el frontend React.  
- **mssql** -> conexión a base de datos SQL Server.  
- **multer** -> manejo de archivos subidos (uploads de proyectos).  
- **archiver** -> generación de archivos ZIP para descargas de proyectos.  
- **pm2** -> control de procesos Node.js (start, stop, restart, list).  
- **ignore** -> soporte para archivos `.gitignore` en la carga de proyectos.  
- **dotenv** -> manejo de variables de entorno.  
- **https** -> consultas a APIs externas en el monitoreo.

---

## 3. Flujo de inicialización (`server.js`)

1. **Carga de variables de entorno** con `dotenv`.  
2. **Configuración de conexión a SQL Server** usando `mssql` y `poolPromise`.  
3. **Definición de rutas** mediante `express.Router()`, inyectando dependencias a cada módulo:
   - `/api/auth` (auth.js)  
   - `/api/users` (users.js)  
   - `/api/projects` (projects.js)  
   - `/api/apis` (apis.js)  
   - `/api/services` (services.js)  
4. **Middlewares habilitados**:
   - `cors()` para habilitar peticiones cross-origin.  
   - `express.json()` para parsear JSON.  
   - `multer` para manejar uploads temporales en `TEMP_UPLOADS`.  
5. **Limpieza de archivos temporales** al apagar el servidor (`SIGINT`, `SIGTERM`).

---

## 4. Módulos principales

### 4.1. Autenticación (`auth.js`)
- **Ruta POST `/api/login`**
  - Recibe: `{ username, password }`.  
  - Consulta la tabla `Users` en SQL Server.  
  - Si coincide, devuelve los datos del usuario y actualiza `lastAccess`.  
  - Si no, responde con `401 Unauthorized`.

### 4.2. Gestión de usuarios (`users.js`)
- **GET `/api/users`** -> lista todos los usuarios.  
- **GET `/api/users/:id`** -> obtiene un usuario por ID.  
- **POST `/api/users`** -> crea un usuario nuevo.  
- **PUT `/api/users/:id`** -> actualiza campos de un usuario.  
- **DELETE `/api/users/:id`** -> elimina un usuario.  

Los usuarios tienen atributos: `id, name, username, email, rol, state, lastAccess`.

### 4.3. Gestión de proyectos (`projects.js`)
- **GET `/api/projects`** -> lista proyectos con su última versión.  
- **POST `/api/upload`** -> sube un nuevo proyecto o una versión adicional.  
  - Soporta múltiples archivos.  
  - Respeta reglas de `.gitignore` para excluir archivos.  
  - Crea carpetas `v1`, `v2`, … en disco.  
- **GET `/api/projects/:id/versions`** -> lista el historial de versiones.  
- **GET `/api/projects/:id/versions/:version/download`** -> genera un ZIP de la versión seleccionada.  
- **PUT `/api/projects/:id`** -> actualiza el nombre y la descripcion de un proyecto de la base de datos y del disco.
- **DELETE `/api/projects/:id`** -> elimina proyecto de base de datos y del disco.

### 4.4. Monitoreo de APIs (`apis.js`)
- **POST `/api/apis`** -> registra una API (nombre y URL).  
- **DELETE `/api/apis/:id`** -> elimina API registrada.  
- **GET `/api/monitor/apis`** -> verifica todas las APIs guardadas:
  - Realiza petición `https.get()`.  
  - Mide tiempo de respuesta (`responseTime`).  
  - Calcula tamaño de respuesta (`payloadSize`).  
  - Determina estado (`Operativo` o `Caído`).  
  - Devuelve métricas con fecha/hora del último chequeo.

### 4.5. Gestión de servicios (`services.js`)
- **GET `/api/services/list`**
  - Devuelve la lista de procesos en PM2 con detalles técnicos: nombre, estado, consumo de recursos, uptime.  
- **POST `/api/services/:accion/:name`**
  - Permite `start`, `stop` o `restart` de un proceso.  
  - Usa conexión temporal a PM2 (`pm2.connect()` -> acción -> `pm2.disconnect()`).

---

## 5. Base de datos

El sistema utiliza **SQL Server** con las siguientes tablas principales:

- **Users**
  - `id, name, username, email, password, rol, state, lastAccess`  
  | Column Name  | Data Type   | Max Length | Nullable |
  |-------------|------------|------------|----------|
  | id          | int        | NULL       | NO       |
  | name        | nvarchar   | 255        | NO       |
  | username    | nvarchar   | 255        | NO       |
  | email       | nvarchar   | 255        | NO       |
  | rol         | nvarchar   | 50         | NO       |
  | password    | nvarchar   | 255        | NO       |
  | state       | bit        | NULL       | NO       |
  | lastAccess  | datetime2  | NULL       | YES      |


- **Projects**
  - `id, name, description, owner, date, path` 
  | Column Name  | Data Type   | Max Length | Nullable |
  |-------------|------------|------------|----------|
  | id          | int        | NULL       | NO       |
  | name        | nvarchar   | 255        | NO       |
  | date        | date       | NULL       | NO       |
  | owner       | int        | NULL       | NO       |
  | description | nvarchar   | -1         | YES      |
  | path        | nvarchar   | 255        | YES      |
 

- **ProjectVersions**
  - `id, projectId, versionNumber, path, uploadedBy, uploadDate, isLatest`  
  | Column Name    | Data Type   | Max Length | Nullable |
  |----------------|------------|------------|----------|
  | id             | int        | NULL       | NO       |
  | projectId      | int        | NULL       | NO       |
  | versionNumber  | int        | NULL       | NO       |
  | path           | nvarchar   | 500        | NO       |
  | uploadDate     | datetime2  | NULL       | NO       |
  | uploadedBy     | int        | NULL       | NO       |
  | isLatest       | bit        | NULL       | NO       |


- **Apis**
  - `id, name, path`
  | Column Name | Data Type | Max Length | Nullable |
  |------------|-----------|------------|----------|
  | id         | int       | NULL       | NO       |
  | name       | varchar   | 50         | NO       |
  | path       | varchar   | 100        | NO       |


---

## 6. Consideraciones técnicas

- Los archivos subidos temporalmente por `multer` se almacenan en `TEMP_UPLOADS` antes de moverse a su carpeta definitiva.  
- Al finalizar un upload, los archivos se reubican y se eliminan los temporales para optimizar espacio.  
- `.gitignore` permite excluir directorios como `node_modules/` en las subidas de proyectos.  
- La descarga de versiones se maneja con **streams** usando `archiver`, evitando problemas de memoria.  
- PM2 se usa como backend de orquestación de servicios, integrándose vía API.  

---

## 7. Ejemplo de flujo completo

1. Un **Developer** inicia sesión vía `/api/login`.  
2. Sube un proyecto con `POST /api/upload`.  
   - El backend valida campos, respeta `.gitignore`, guarda en disco y registra en DB.  
3. El sistema crea `Projects` y `ProjectVersions`.  
4. El **Viewer** consulta el proyecto vía `GET /api/projects`.  
5. El **Admin** monitorea APIs con `GET /api/monitor/apis`.  
6. Si un servicio falla, el **Developer** lo reinicia vía `POST /api/services/restart/:name`.  

---

## 8. Próximos pasos para desarrolladores

- Agregar validaciones adicionales en rutas de usuarios (ej. cifrado de contraseñas).  
- Implementar middlewares de autenticación con JWT o sesiones para proteger endpoints.  
- Optimizar el monitoreo de APIs con workers en segundo plano en lugar de peticiones síncronas.  
- Implementar pruebas automatizadas (unitarias e integradas) para cada módulo.  

---
