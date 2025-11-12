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

// IMPORTAR RUTAS
import projectsRouter from './routes/projects.js';
import apisRouter from './routes/apis.js';
import servicesRouter from './routes/services.js';
import usersRouter from './routes/users.js';


// CONFIGURACIÓN DE LA BASE DE DATOS
const config = {
  server: process.env.DB_HOST || '',
  database: process.env.DB_NAME || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASS || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// CONEXIÓN A LA BASE DE DATOS
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


// INICIALIZAR EXPRESS
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// MIDDLEWARES
app.use(cors());
app.use(express.json());


// DIRECTORIO PARA PROYECTOS
const PROJECTS_PATH = process.env.PROJECTS_PATH || 'C:/Users/drueda/Desktop/Prueba';
if (!fs.existsSync(PROJECTS_PATH)) {
  fs.mkdirSync(PROJECTS_PATH, { recursive: true });
}

// DIRECTORIO TEMPORAL PARA SUBIDAS 
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMP_UPLOADS = process.env.TEMP_UPLOADS || path.join(__dirname, '..', '..', 'var', 'tmp');
if (!fs.existsSync(TEMP_UPLOADS)) fs.mkdirSync(TEMP_UPLOADS, { recursive: true });
const upload = multer({ dest: TEMP_UPLOADS }); // Middleware para manejo de archivos

// RUTAS
app.use(
  '/api',

// INYECTAR DEPENDENCIAS EN ROUTERS
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
//
app.use('/api', usersRouter({ poolPromise, sql, config }));
app.use('/api', apisRouter({ poolPromise, sql, https }));
app.use('/api', servicesRouter({ poolPromise, sql, pm2 }));

// REGISTRO DE RUTAS DE AUTENTICACIÓN
import authRouter from './routes/auth.js';
app.use('/api', authRouter({ poolPromise, sql }));

// INICIAR SERVIDOR
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));

// LIMPIEZA DE ARCHIVOS TEMPORALES AL CERRAR EL SERVIDOR
function cleanup() {
  console.log('\nServer shutting down. Cleaning up temporary files...');
  const tempDir = TEMP_UPLOADS;
  if (fs.existsSync(tempDir)) {

    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up temporary uploads directory: ${tempDir}`);
  }
  process.exit();
}

// CAPTURAR SEÑALES DE TERMINACIÓN
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
