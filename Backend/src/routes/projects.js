// routes/projects.js
import express from 'express';
import ignore from 'ignore';


export default ({ poolPromise, sql, PROJECTS_PATH, upload, path, fs, archiver }) => {
  const router = express.Router();

  // LISTAR PROYECTOS Y SU ÚLTIMA VERSIÓN
  router.get('/projects', async (req, res) => {
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
      console.error('Error consultando proyectos:', err);
      res.status(500).json({ error: 'No se pudieron obtener los proyectos' });
    }
  });

 
  // SUBIR NUEVO PROYECTO O VERSIÓN
  router.post('/upload', upload.array('files'), async (req, res) => {
    try {
      const { name, description, owner, date } = req.body;

      const ownerInt = parseInt(owner, 10);
      if (isNaN(ownerInt)) {
        return res.status(400).json({ error: 'el propietario debe ser un número entero' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "los archivos son obligatorios. Use el campo 'files' en el formulario.",
        });
      }

      // Normalizar nombre de carpeta (eliminar caracteres problemáticos)
      const folderName = name.trim().replace(/[^a-zA-Z0-9._ -]/g, '_');
      const baseProjectFolder = path.join(PROJECTS_PATH, folderName);
      fs.mkdirSync(baseProjectFolder, { recursive: true });

      const pool = await poolPromise;

      // Obtener o crear el ID del proyecto
      let projectId;
      const existing = await pool
        .request()
        .input('name', sql.NVarChar, folderName)
        .query('SELECT id FROM Projects WHERE name = @name');

      if (existing.recordset.length === 0) {
        const insertProject = await pool
          .request()
          .input('name', sql.NVarChar, folderName)
          .input('date', sql.Date, date)
          .input('owner', sql.Int, ownerInt)
          .input('description', sql.NVarChar, description || '')
          .input('path', sql.NVarChar, baseProjectFolder).query(`
                        INSERT INTO Projects (name, date, owner, description, path)
                        OUTPUT INSERTED.id
                        VALUES (@name, @date, @owner, @description, @path)
                    `);
        projectId = insertProject.recordset[0].id;
      } else {
        projectId = existing.recordset[0].id;
      }

      // Versión (obtener la última)
      const lastVersion = await pool.request().input('projectId', sql.Int, projectId).query(`
                    SELECT TOP 1 versionNumber
                    FROM ProjectVersions
                    WHERE projectId = @projectId
                    ORDER BY versionNumber DESC
                `);

      const newVersionNumber =
        lastVersion.recordset.length > 0 ? lastVersion.recordset[0].versionNumber + 1 : 1;

      const versionFolderName = `v${newVersionNumber}`;
      const destinationFolder = path.join(baseProjectFolder, versionFolderName);
      fs.mkdirSync(destinationFolder, { recursive: true });

      // 2. Filtrar y mover los archivos: preservar subdirectorios si el cliente
      // envía rutas relativas en originalname (p. ej. 'src/index.js')
      // Primero, construir uploadEntries intentando usar req.body.paths (enviado
      // por el cliente) para preservar rutas relativas y evitar depender de
      // cómo el multipart encodes filenames. req.body.paths puede ser una
      // cadena o un array dependiendo del cliente; normalizamos a array.
      let paths = req.body.paths || [];
      if (typeof paths === 'string') {
        // si solo hay un paths será una única cadena
        paths = [paths];
      }

      const uploadEntries = req.files.map((file, idx) => {
        // Preferir la ruta explícita enviada en FormData
        let rawRelative =
          (paths && paths[idx]) || file.originalname || file.filename || file.path || file.name;
        if (typeof rawRelative !== 'string')
          rawRelative = String(rawRelative || file.originalname || file.filename || 'file');
        rawRelative = rawRelative.replace(/\\/g, '/');

        let segments = rawRelative
          .split('/')
          .filter(Boolean)
          .map((s) => s.trim());
        segments = segments.filter((s) => s !== '.' && s !== '..');
        segments = segments.map((s) => s.replace(/[^a-zA-Z0-9._ -]/g, '_'));
        const relativePath = segments.join('/');
        return { file, relativePath, segments };
      });

      let allowedSet = null;
      const gitignoreEntry = uploadEntries.find((e) => e.relativePath === '.gitignore');
      if (gitignoreEntry) {
        try {
          const gitignoreContent = fs.readFileSync(gitignoreEntry.file.path, 'utf8');
          const ig = ignore().add(gitignoreContent);
          const allPaths = uploadEntries.map((e) => e.relativePath);
          const filtered = ig.filter(allPaths);
          allowedSet = new Set(
            filtered.filter((p) => !p.split('/').some((seg) => seg === 'node_modules'))
          );
        } catch (e) {
          console.warn('[UPLOAD] Error applying uploaded .gitignore:', e);
          allowedSet = null;
        } finally {
          // eliminar el .gitignore temporal
          try {
            fs.unlinkSync(gitignoreEntry.file.path);
          } catch (e) {
            /* ignore */
          }
        }
      }

      if (!allowedSet) {
        allowedSet = new Set(
          uploadEntries
            .map((e) => e.relativePath)
            .filter((p) => !p.split('/').some((seg) => seg === 'node_modules'))
        );
      }

      for (const entry of uploadEntries) {
        const { file, relativePath, segments } = entry;
        console.log(`[UPLOAD] Procesando archivo (original: ${file.originalname}):`, relativePath);

        // si es .gitignore temporal -> eliminarlo
        if (relativePath === '.gitignore') {
          console.log('[UPLOAD] Eliminando .gitignore temporal:', file.path);
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            /* ignore */
          }
          continue;
        }

        if (!allowedSet.has(relativePath)) {
          console.log(`[UPLOAD] Ignorando por regla (node_modules): ${relativePath}`);
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            /* ignore */
          }
          continue;
        }

        // Crear subdirectorios en destination si es necesario (preservando la estructura)
        const destPath = path.join(destinationFolder, ...segments);
        const destDir = path.dirname(destPath);
        fs.mkdirSync(destDir, { recursive: true });

        try {
          fs.renameSync(file.path, destPath);
        } catch (e) {
          // si falla el rename, copiar y eliminar
          try {
            const data = fs.readFileSync(file.path);
            fs.writeFileSync(destPath, data);
            try {
              fs.unlinkSync(file.path);
            } catch (e2) {
              /* ignore */
            }
          } catch (e2) {
            console.error(`Error moviendo archivo ${file.originalname}:`, e2);
            // continuar con otros archivos
          }
        }
      }

      // Desmarcar versión previa
      await pool.request().input('projectId', sql.Int, projectId).query(`
                UPDATE ProjectVersions
                SET isLatest = 0
                WHERE projectId = @projectId AND isLatest = 1
            `);

      // Guardar la nueva versión
      await pool
        .request()
        .input('projectId', sql.Int, projectId)
        .input('versionNumber', sql.Int, newVersionNumber)
        .input('path', sql.NVarChar, destinationFolder)
        .input('uploadedBy', sql.Int, ownerInt).query(`
                    INSERT INTO ProjectVersions (projectId, versionNumber, path, uploadedBy, isLatest)
                    VALUES (@projectId, @versionNumber, @path, @uploadedBy, 1)
                `);

      res.status(200).json({
        message: 'Project uploaded and version created successfully (with .gitignore support)',
        projectId,
        version: newVersionNumber,
        path: destinationFolder,
      });
    } catch (err) {
      console.error('Error uploading project:', err);
      // Asegurarse de limpiar archivos temporales si falla la subida
      if (req.files) {
        for (const file of req.files) {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            /* ignore */
          }
        }
      }
      res.status(500).json({ error: 'Could not upload project' });
    }
  });

  // DESCARGAR VERSIÓN COMO ZIP
  router.get('/projects/:id/versions/:version/download', async (req, res) => {
    try {
      const { id, version } = req.params;

      const pool = await poolPromise;

      const result = await pool
        .request()
        .input('projectId', sql.Int, id)
        .input('versionNumber', sql.Int, version).query(`
                    SELECT p.name AS projectName, pv.path
                    FROM ProjectVersions pv
                    INNER JOIN Projects p ON pv.projectId = p.id
                    WHERE pv.projectId = @projectId AND pv.versionNumber = @versionNumber
                `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Versión no encontrada' });
      }

      const { projectName, path: folderPath } = result.recordset[0];
      const safeProjectName = projectName.replace(/[^a-z0-9_-]/gi, '_');
      const zipName = `${safeProjectName}_v${version}.zip`;

      res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error('Error en archiver:', err);
        res.status(500).end();
      });

      archive.pipe(res);
      archive.directory(folderPath, false);
      archive.finalize();
    } catch (err) {
      console.error('Error al descargar versión:', err);
      res.status(500).json({ error: 'Error al generar ZIP' });
    }
  });

  // OBTENER HISTORIAL DE VERSIONES DE UN PROYECTO
  router.get('/projects/:id/versions', async (req, res) => {
    try {
      const { id } = req.params;

      const pool = await poolPromise;

      const result = await pool.request().input('id', sql.Int, id).query(`
                SELECT versionNumber, path, uploadDate, isLatest, uploadedBy
                FROM ProjectVersions
                WHERE projectId = @id
                ORDER BY versionNumber DESC
            `);

      res.json(result.recordset);
    } catch (err) {
      console.error('Error obteniendo versiones:', err);
      res.status(500).json({ error: 'No se pudo obtener el historial' });
    }
  });

  // ACTUALIZAR METADATOS DEL PROYECTO (nombre, descripción)
 router.put('/projects/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'El ID del proyecto debe ser un número entero.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    const pool = await poolPromise;

    // Obtener la carpeta actual del proyecto
    const projectResult = await pool
      .request()
      .input('id', sql.Int, projectId)
      .query('SELECT name FROM Projects WHERE id = @id');

    if (projectResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    const oldFolderName = projectResult.recordset[0].name;
    const oldPath = path.join(PROJECTS_PATH, oldFolderName);

    // Normalizar nuevo nombre de carpeta
    const newFolderName = name.trim().replace(/[^a-zA-Z0-9._ -]/g, '_');
    const newPath = path.join(PROJECTS_PATH, newFolderName);

    // Comprobar si ya existe otro proyecto con el mismo nombre
    const existing = await pool
      .request()
      .input('id', sql.Int, projectId)
      .input('name', sql.NVarChar, newFolderName)
      .query(`
        SELECT id FROM Projects
        WHERE name = @name AND id <> @id
      `);

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'Ya existe un proyecto con ese nombre.' });
    }

    // Renombrar la carpeta física
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`[UPDATE] Carpeta renombrada de ${oldPath} a ${newPath}`);
    } else {
      console.warn(`[UPDATE] Carpeta antigua no encontrada: ${oldPath}`);
    }

    // Actualizar la base de datos
    await pool
      .request()
      .input('id', sql.Int, projectId)
      .input('name', sql.NVarChar, newFolderName)
      .input('description', sql.NVarChar, description || '')
      .input('path', sql.NVarChar, newPath)
      .query(`
        UPDATE Projects
        SET name = @name, description = @description, path = @path
        WHERE id = @id
      `);

    res.json({ message: 'Proyecto actualizado correctamente.' });
  } catch (err) {
    console.error('Error actualizando proyecto:', err);
    res.status(500).json({ error: 'No se pudo actualizar el proyecto' });
  }
});

  // ELIMINAR PROYECTO Y SUS VERSIONES
  router.delete('/projects/:id', async (req, res) => {
    try {
      const projectId = parseInt(req.params.id, 10);

      const pool = await poolPromise;

      if (isNaN(projectId)) {
        console.error('ID de proyecto inválido o no numérico recibido:', req.params.id);
        return res.status(400).json({ error: 'El ID del proyecto debe ser un número entero.' });
      }

      // 1. Obtener el nombre de la carpeta
      const projectResult = await pool
        .request()
        .input('id', sql.Int, projectId)
        .query('SELECT name FROM Projects WHERE id = @id');

      if (projectResult.recordset.length === 0) {
        return res.status(404).json({ error: 'Proyecto no encontrado en la base de datos.' });
      }

      const projectName = projectResult.recordset[0].name;

      // 2. Eliminar el proyecto de la DB
      await pool.request().input('id', sql.Int, projectId).query(`
                DELETE FROM Projects WHERE id = @id
            `);

      // 3. Borrar la carpeta física en disco
      const projectFolder = path.join(PROJECTS_PATH, projectName);

      if (fs.existsSync(projectFolder)) {
        fs.rmSync(projectFolder, { recursive: true, force: true });
        console.log(`Carpeta eliminada: ${projectFolder}`);
      } else {
        console.warn(`Carpeta del proyecto ${projectName} no encontrada en disco. Se continúa.`);
      }

      res.json({ message: 'Proyecto y versiones eliminados correctamente' });
    } catch (err) {
      console.error('Error eliminando proyecto:', err);
      res.status(500).json({ error: 'No se pudo eliminar el proyecto' });
    }
  });

  return router;
};
