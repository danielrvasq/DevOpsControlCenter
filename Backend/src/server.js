import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import multer from "multer";
import archiver from "archiver";
import https from "https";
import sql from "mssql";
import pm2 from "pm2";
import ignore from "ignore";

/* ==============================
    CONEXIÓN CON LA BASE DE DATOS
================================ */
const config = {
  server: "localhost",
  database: "DevOpsControlCenter",
  user: "Prueba",
  password: "admin",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server successfully!");
    return pool;
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

const app = express();
app.use(cors());
app.use(express.json());

/* ==============================
    CONFIGURACIÓN DE PROYECTOS
================================ */
const PROJECTS_PATH = "C:/Users/drueda/Desktop/Prueba";

if (!fs.existsSync(PROJECTS_PATH)) {
  fs.mkdirSync(PROJECTS_PATH, { recursive: true });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const upload = multer({ dest: "temp-uploads/" });

/* ==============================
    MANEJO DE PROYECTOS CON VERSIONES
================================ */

// 📌 Listar proyectos con su última versión
app.get("/api/projects", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT p.id, p.name, p.description, p.date, u.username AS ownerName,
             v.versionNumber, v.path, v.uploadDate
      FROM Projects p
      INNER JOIN Users u ON p.owner = u.id
      INNER JOIN ProjectVersions v ON v.projectId = p.id
      WHERE v.isLatest = 1
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error consultando proyectos:", err);
    res.status(500).json({ error: "No se pudieron obtener los proyectos" });
  }
});

// 📌 Subir proyecto (nueva versión o primer proyecto)
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const { name, description, owner, date } = req.body;

    if (!name || !owner || !date) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, owner, date" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No files were sent. Did you set name='files' in <input>?",
      });
    }

    const folderName = name.trim();
    const baseProjectFolder = path.join(PROJECTS_PATH, folderName);
    fs.mkdirSync(baseProjectFolder, { recursive: true });

    const pool = await poolPromise; // 🔍 1. Buscar si hay un .gitignore en los archivos subidos

    const gitignoreFile = req.files.find(
      (f) => f.originalname === ".gitignore"
    );
    let ig = null;

    if (gitignoreFile) {
      const gitignoreContent = fs.readFileSync(gitignoreFile.path, "utf8");
      ig = ignore().add(gitignoreContent);
      console.log("Se cargó .gitignore con reglas:\n", gitignoreContent);
    } // 📌 Obtener el ID del proyecto

    let projectId;
    const existing = await pool
      .request()
      .input("name", sql.NVarChar, folderName)
      .query("SELECT id FROM Projects WHERE name = @name");

    if (existing.recordset.length === 0) {
      const insertProject = await pool
        .request()
        .input("name", sql.NVarChar, folderName)
        .input("date", sql.Date, date)
        .input("owner", sql.Int, owner)
        .input("description", sql.NVarChar, description || "")
        .input("path", sql.NVarChar, baseProjectFolder).query(`
          INSERT INTO Projects (name, date, owner, description, path)
          OUTPUT INSERTED.id
          VALUES (@name, @date, @owner, @description, @path)
        `);
      projectId = insertProject.recordset[0].id;
    } else {
      projectId = existing.recordset[0].id;
    } // 📌 Versión

    const lastVersion = await pool
      .request()
      .input("projectId", sql.Int, projectId).query(`
        SELECT TOP 1 versionNumber
        FROM ProjectVersions
        WHERE projectId = @projectId
        ORDER BY versionNumber DESC
      `);

    const newVersionNumber =
      lastVersion.recordset.length > 0
        ? lastVersion.recordset[0].versionNumber + 1
        : 1;

    const versionFolderName = `v${newVersionNumber}`;
    const destinationFolder = path.join(baseProjectFolder, versionFolderName);
    fs.mkdirSync(destinationFolder, { recursive: true }); // 🔍 2. Filtrar y mover los archivos aplicando .gitignore

    req.files.forEach((file) => {
      const relativePath = file.originalname; // lo usamos para comparar con .gitignore
      const shouldIgnore = ig ? ig.ignores(relativePath) : false;

      if (shouldIgnore) {
        console.log(`Ignorando: ${relativePath}`);
        fs.unlinkSync(file.path); // eliminar archivo temporal
      } else {
        const destPath = path.join(destinationFolder, file.originalname);
        fs.renameSync(file.path, destPath);
      }
    }); // Desmarcar versión previa

    await pool.request().input("projectId", sql.Int, projectId).query(`
      UPDATE ProjectVersions
      SET isLatest = 0
      WHERE projectId = @projectId AND isLatest = 1
    `); // Guardar la nueva versión

    await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("versionNumber", sql.Int, newVersionNumber)
      .input("path", sql.NVarChar, destinationFolder)
      .input("uploadedBy", sql.Int, owner).query(`
        INSERT INTO ProjectVersions (projectId, versionNumber, path, uploadedBy, isLatest)
        VALUES (@projectId, @versionNumber, @path, @uploadedBy, 1)
      `);

    res.status(200).json({
      message:
        "Project uploaded and version created successfully (with .gitignore support)",
      projectId,
      version: newVersionNumber,
      path: destinationFolder,
    });
  } catch (err) {
    console.error("Error uploading project:", err);
    res.status(500).json({ error: "Could not upload project" });
  }
});

// Descargar una versión específica de un proyecto
app.get("/api/projects/:id/versions/:version/download", async (req, res) => {
  try {
    const { id, version } = req.params;

    const pool = await poolPromise; // Obtener nombre del proyecto y la ruta de la versión

    const result = await pool
      .request()
      .input("projectId", sql.Int, id)
      .input("versionNumber", sql.Int, version).query(`
        SELECT p.name AS projectName, pv.path
        FROM ProjectVersions pv
        INNER JOIN Projects p ON pv.projectId = p.id
        WHERE pv.projectId = @projectId AND pv.versionNumber = @versionNumber
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Versión no encontrada" });
    }

    const { projectName, path: folderPath } = result.recordset[0]; // Limpieza opcional: evitar espacios o caracteres inválidos en el nombre

    const safeProjectName = projectName.replace(/[^a-z0-9_\-]/gi, "_");
    const zipName = `${safeProjectName}_v${version}.zip`; // Crear zip en memoria y enviarlo

    res.setHeader("Content-Disposition", `attachment; filename=${zipName}`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
  } catch (err) {
    console.error("Error al descargar versión:", err);
    res.status(500).json({ error: "Error al generar ZIP" });
  }
});

// 📌 Consultar historial de versiones de un proyecto
app.get("/api/projects/:id/versions", async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, id).query(`
        SELECT versionNumber, path, uploadDate, isLatest, uploadedBy
        FROM ProjectVersions
        WHERE projectId = @id
        ORDER BY versionNumber DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error obteniendo versiones:", err);
    res.status(500).json({ error: "No se pudo obtener el historial" });
  }
});

// 📌 Eliminar proyecto (borra también sus versiones)
app.delete("/api/projects/:id", async (req, res) => {
  try {
    // 🛑 CRÍTICO: Convertir el ID de la URL (string) a un número (int)
    const projectId = parseInt(req.params.id, 10);

    const pool = await poolPromise; // Verificar si la conversión falló (ej: si el frontend envió un nombre de proyecto como 'DevOps')

    if (isNaN(projectId)) {
      console.error(
        "ID de proyecto inválido o no numérico recibido:",
        req.params.id
      );
      return res
        .status(400)
        .json({ error: "El ID del proyecto debe ser un número entero." });
    } // 1. Obtener el nombre de la carpeta (Project Name) antes de eliminar el registro de la DB

    const projectResult = await pool
      .request()
      .input("id", sql.Int, projectId) // Usamos el ID numérico
      .query("SELECT name FROM Projects WHERE id = @id");

    if (projectResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Proyecto no encontrado en la base de datos." });
    }

    const projectName = projectResult.recordset[0].name; // 2. Eliminar el proyecto y sus versiones de la DB // (La eliminación en cascada es ideal, si no está configurada, ProjectVersions se borran automáticamente si no tienen FK)

    await pool.request().input("id", sql.Int, projectId).query(`
      DELETE FROM Projects WHERE id = @id
    `); // 3. Borrar la carpeta física en disco usando el NOMBRE del proyecto

    const projectFolder = path.join(PROJECTS_PATH, projectName);

    if (fs.existsSync(projectFolder)) {
      fs.rmSync(projectFolder, { recursive: true, force: true });
      console.log(`Carpeta eliminada: ${projectFolder}`);
    } else {
      console.warn(
        `Carpeta del proyecto ${projectName} no encontrada en disco. Se continúa.`
      );
    }

    res.json({ message: "Proyecto y versiones eliminados correctamente" });
  } catch (err) {
    console.error("Error eliminando proyecto:", err);
    res.status(500).json({ error: "No se pudo eliminar el proyecto" });
  }
});

/* ==============================
    MANEJO DE USUARIOS
================================ */

app.get("/api/users", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT id, name, username, email, rol, state,
             FORMAT(lastAccess, 'yyyy-MM-dd HH:mm:ss') AS lastAccess
      FROM Users
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Could not fetch users" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().input("id", sql.Int, req.params.id)
      .query(`
        SELECT id, name, username, email, rol, state, lastAccess
        FROM Users
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error en /api/users/:id:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Users WHERE id = @id");

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, username, email, password, rol } = req.body;

    const pool = await sql.connect(config);

    await pool
      .request()
      .input("name", sql.VarChar, name)
      .input("username", sql.VarChar, username)
      .input("email", sql.VarChar, email)
      .input("password", sql.VarChar, password)
      .input("rol", sql.VarChar, rol).query(`
        INSERT INTO Users (name, username, email, password, rol, state, lastAccess)
        VALUES (@name, @username, @email, @password, @rol, DEFAULT, NULL)
      `);

    res.status(201).json({ message: "Usuario creado exitosamente" });
  } catch (err) {
    console.error("Error creando usuario:", err);
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, rol } = req.body;

    const pool = await sql.connect(config); // Verificar que el usuario exista

    const existing = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT id FROM Users WHERE id = @id");

    if (existing.recordset.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    } // Actualizar solo los campos permitidos

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.VarChar, name || null)
      .input("username", sql.VarChar, username || null)
      .input("password", sql.VarChar, password || null) // Aquí puedes aplicar hash si quieres
      .input("rol", sql.VarChar, rol || null).query(`
        UPDATE Users
        SET
          name = ISNULL(@name, name),
          username = ISNULL(@username, username),
          password = ISNULL(@password, password),
          rol = ISNULL(@rol, rol)
        WHERE id = @id
      `);

    res.json({ message: "Usuario actualizado correctamente" });
  } catch (err) {
    console.error("Error actualizando usuario:", err);
    res.status(500).json({ error: "No se pudo actualizar el usuario" });
  }
});

/* ==============================
    LOGIN
================================ */

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, password).query(`
        SELECT id, name, username, email, rol, state, lastAccess
        FROM Users
        WHERE username = @username AND password = @password
      `);

    if (result.recordset.length === 0) {
      return res
        .status(401)
        .json({ message: "Usuario o contraseña incorrectos" });
    }

    const user = result.recordset[0];

    await pool.request().input("id", sql.Int, user.id).query(`
      UPDATE Users
      SET lastAccess = GETDATE()
      WHERE id = @id
    `);

    res.json({ ...user, lastAccess: new Date() });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

/* ==============================
    CREAR NUEVA API
================================ */

app.post("/api/apis", async (req, res) => {
  try {
    const { name, path } = req.body;

    if (!name || !path) {
      return res
        .status(400)
        .json({ error: "Faltan campos requeridos: name, path" });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("name", sql.NVarChar, name)
      .input("path", sql.NVarChar, path).query(`
        INSERT INTO Apis (name, path)
        VALUES (@name, @path)
      `);

    res.status(201).json({ message: "API creada exitosamente" });
  } catch (err) {
    console.error("Error creando API:", err);
    res.status(500).json({ error: "No se pudo crear la API" });
  }
});

/* ==============================
    ELIMINAR API
================================ */

app.delete("/api/apis/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await sql.connect(config);

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Apis WHERE id = @id");

    res.json({ message: "API eliminada correctamente" });
  } catch (err) {
    console.error("Error eliminando la API:", err);
    res.status(500).json({ error: "No se pudo eliminar la API" });
  }
});

/* ==============================
    MONITOREO DE APIS
================================ */

app.get("/api/monitor/apis", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .query("SELECT id, name, path FROM Apis");

    const apisToMonitor = result.recordset;

    if (apisToMonitor.length === 0) {
      return res.status(200).json([]);
    }

    const monitoringPromises = apisToMonitor.map(async (api) => {
      const { id, name, path } = api;

      const startTime = process.hrtime();

      try {
        const data = await new Promise((resolve, reject) => {
          const req = https.get(path, (apiRes) => {
            const { statusCode } = apiRes;

            let responseData = "";

            if (statusCode < 200 || statusCode >= 300) {
              reject(
                new Error(`Request Failed with Status Code: ${statusCode}`)
              );
              return;
            }

            apiRes.on("data", (chunk) => (responseData += chunk));
            apiRes.on("end", () => resolve(responseData));
          });

          req.on("error", (err) => reject(err));
        });

        const endTime = process.hrtime(startTime);
        const responseTimeMs = (endTime[0] * 1e9 + endTime[1]) / 1e6;
        const payloadSizeKB = Buffer.byteLength(data) / 1024;

        return {
          id,
          name,
          path,
          responseTime: parseFloat(responseTimeMs.toFixed(2)),
          availability: "Operativo",
          payloadSize: parseFloat(payloadSizeKB.toFixed(2)),
          statusCode: 200,
          lastCheck: new Date(),
        };
      } catch (e) {
        const endTime = process.hrtime(startTime);
        const responseTimeMs = (endTime[0] * 1e9 + endTime[1]) / 1e6;
        const errorMessage = e.message;

        const statusCodeMatch = errorMessage.match(/Status Code: (\d+)/);
        const statusCode = statusCodeMatch
          ? parseInt(statusCodeMatch[1], 10)
          : null;

        return {
          id,
          name,
          path,
          responseTime: parseFloat(responseTimeMs.toFixed(2)),
          availability: "Caído",
          payloadSize: 0,
          statusCode,
          error: errorMessage,
          lastCheck: new Date(),
        };
      }
    });

    const results = await Promise.all(monitoringPromises);

    res.json(results);
  } catch (err) {
    console.error("Error monitoring APIs:", err);
    res.status(500).json({ error: "Could not fetch and monitor APIs" });
  }
});

/* ==============================
    INICIAR/DETENER/REINICIAR SERVICIO CON PM2
================================ */

app.post("/api/services/:accion/:name", (req, res) => {
  const { accion, name } = req.params; // Validar acción

  const accionesPermitidas = ["start", "stop", "restart"];

  if (!accionesPermitidas.includes(accion)) {
    return res.status(400).json({ error: `Acción no permitida: ${accion}` });
  }

  pm2.connect((err) => {
    if (err) {
      console.error("Error connecting to PM2:", err);
      return res.status(500).json({ error: "No se pudo conectar a PM2" });
    }

    pm2[accion](name, (err, proc) => {
      pm2.disconnect();

      if (err) {
        console.error(`Error al ${accion} servicio:`, err);
        return res
          .status(500)
          .json({ error: `No se pudo ${accion} el servicio` });
      }

      return res.json({
        message: `Servicio ${name} ${accion} ejecutado correctamente`,
      });
    });
  });
});

/* ==============================
    LISTAR SERVICIOS PM2
================================ */

app.get("/api/services/list", (req, res) => {
  pm2.connect((err) => {
    if (err) {
      console.error("Error conectando con PM2:", err);
      return res.status(500).json({ error: "No se pudo conectar a PM2" });
    }

    pm2.list((err, processDescriptionList) => {
      pm2.disconnect(); // importante: cerrar conexión

      if (err) {
        console.error("Error obteniendo lista de servicios:", err);
        return res
          .status(500)
          .json({ error: "No se pudo listar los servicios" });
      } // Transformar salida para el frontend

      const services = processDescriptionList.map((proc) => ({
        name: proc.name,
        pm_id: proc.pm_id,
        status: proc.pm2_env.status, // online / stopped / etc.
        script: proc.pm2_env.pm_exec_path,
        cwd: proc.pm2_env.pm_cwd,
        instances: proc.pm2_env.instances,
        monit: proc.monit, // { memory, cpu }
        port: proc.pm2_env.env.PORT || null,
        restartTime: proc.pm2_env.restart_time,
        uptime: proc.pm2_env.pm_uptime,
      }));

      res.json(services);
    });
  });
});

/* ==============================
    START SERVER
================================ */

const PORT = 3001;

app.listen(PORT, () =>
  console.log(`Backend listening on http://localhost:${PORT}`)
);
