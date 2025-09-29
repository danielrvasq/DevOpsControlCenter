// server.js

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import archiver from 'archiver';
import https from 'https';
import sql from 'mssql';
import pm2 from 'pm2';
import ignore from 'ignore';
import dotenv from 'dotenv';
dotenv.config();
/*=======
Imports and dependencies
==========*/

// Importar los módulos de rutas
import projectsRouter from './routes/projects.js';
import apisRouter from './routes/apis.js';
import servicesRouter from './routes/services.js';
import usersRouter from './routes/users.js';

/*=======
Database configuration
==========*/
const config = {
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'DevOpsControlCenter',
  user: process.env.DB_USER || 'Prueba',
  password: process.env.DB_PASS || 'admin',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log('Connected to SQL Server successfully!');
    return pool;
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

/* ==============================
    CONFIGURACIÓN DE LA APLICACIÓN
================================ */

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

/*=======
Paths and storage (configurable via env)
==========*/
const PROJECTS_PATH = process.env.PROJECTS_PATH || 'C:/Users/drueda/Desktop/Prueba';
if (!fs.existsSync(PROJECTS_PATH)) {
  fs.mkdirSync(PROJECTS_PATH, { recursive: true });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Use a centralized var/tmp for temporary artifacts (overridable via env)
const TEMP_UPLOADS = process.env.TEMP_UPLOADS || path.join(__dirname, '..', '..', 'var', 'tmp');
if (!fs.existsSync(TEMP_UPLOADS)) fs.mkdirSync(TEMP_UPLOADS, { recursive: true });
const upload = multer({ dest: TEMP_UPLOADS }); // Middleware para manejo de archivos

// Inyectar dependencias y configuraciones a los routers
app.use(
  '/api',
  /*=======
Register routers (inject dependencies)
==========*/
  projectsRouter({
    poolPromise,
    sql,
    PROJECTS_PATH,
    upload,
    path,
    fs,
    archiver,
    ignore,
  })
);
app.use('/api', usersRouter({ poolPromise, sql, config }));
app.use('/api', apisRouter({ poolPromise, sql, https }));
app.use('/api', servicesRouter({ pm2 }));

/* ==============================
    LOGIN (Se mantiene en el archivo principal)
================================ */
// Registrar rutas de autenticación
import authRouter from './routes/auth.js';
app.use('/api', authRouter({ poolPromise, sql }));
/*=======
Authentication routes
==========*/

/* ==============================
    START SERVER
================================ */
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));

/*=======
Start server
==========*/
// Manejo de limpieza de archivos temporales al apagar
function cleanup() {
  console.log('\nServer shutting down. Cleaning up temporary files...');
  const tempDir = TEMP_UPLOADS;
  if (fs.existsSync(tempDir)) {
    /*=======
Cleanup and shutdown
==========*/
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up temporary uploads directory: ${tempDir}`);
  }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
