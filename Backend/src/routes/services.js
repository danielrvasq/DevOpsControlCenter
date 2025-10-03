// routes/services.js
import express from 'express';

export default ({ poolPromise, sql, pm2 }) => {
  const router = express.Router();

  // LISTAR SERVICIOS GESTIONADOS POR PM2
  router.get('/services/list', (req, res) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Error conectando con PM2:', err);
        return res.status(500).json({ error: 'No se pudo conectar a PM2' });
      }

      // Obtener lista de procesos con pm2 list
      pm2.list((err, processDescriptionList) => {
        pm2.disconnect();

        if (err) {
          console.error('Error obteniendo lista de servicios:', err);
          return res.status(500).json({ error: 'No se pudo listar los servicios' });
        }

        // Transformar salida para el frontend
        const services = processDescriptionList.map((proc) => ({
          name: proc.name,
          pm_id: proc.pm_id,
          status: proc.pm2_env.status, // online / stopped / errored
          script: proc.pm2_env.pm_exec_path,
          cwd: proc.pm2_env.cwd,
          instances: proc.pm2_env.instances,
          memory: (proc.monit.memory / 1024 / 1024).toFixed(2), // MB
          cpu: proc.monit.cpu, // %
          port: proc.pm2_env.env.PORT || null,
          restartCount: proc.pm2_env.restart_time,
        }));

        res.json(services);
      });
    });
  });

  // INICIAR TODOS LOS SERVICIOS REGISTRADOS EN LA BASE DE DATOS
  router.post('/services/start-db', async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
        SELECT id, script, name, cwd, port FROM services
      `);

      const servicios = result.recordset;

      if (!servicios || servicios.length === 0) {
        return res.status(404).json({ error: 'No hay servicios registrados en la BD' });
      }

      pm2.connect((err) => {
        if (err) {
          console.error('Error conectando con PM2:', err);
          return res.status(500).json({ error: 'No se pudo conectar a PM2' });
        }

        let pendientes = servicios.length;
        const resultados = [];

        servicios.forEach((serv) => {
          const startOptions = {
            script: serv.script,
            name: serv.name,
            cwd: serv.cwd,
            env: {
              PORT: serv.port || undefined,
            },
          };

          pm2.start(startOptions, (err) => {
            if (err) {
              console.error(`Error al iniciar servicio ${serv.name}:`, err);
              resultados.push({
                servicio: serv.name,
                status: 'error',
                error: err.message,
              });
            } else {
              resultados.push({
                servicio: serv.name,
                status: 'ok',
              });
            }

            if (--pendientes === 0) {
              pm2.disconnect();
              return res.json({
                message: 'Todos los servicios de la BD han sido procesados',
                resultados,
              });
            }
          });
        });
      });
    } catch (error) {
      console.error('Error consultando servicios en la BD:', error);
      return res.status(500).json({ error: 'Error consultando la BD' });
    }
  });

  // INICIAR, DETENER O REINICIAR UN SERVICIO ESPECÍFICO O TODOS
  router.post('/services/:accion/:name', (req, res) => {
    const { accion, name } = req.params;
    const accionesPermitidas = ['start', 'stop', 'restart'];

    if (!accionesPermitidas.includes(accion)) {
      return res.status(400).json({ error: `Acción no permitida: ${accion}` });
    }

    pm2.connect((err) => {
      if (err) {
        console.error('Error connecting to PM2:', err);
        return res.status(500).json({ error: 'No se pudo conectar a PM2' });
      }

      // Caso especial: aplicar acción a todos los servicios
      if (name === 'all') {
        pm2.list((err, list) => {
          if (err) {
            pm2.disconnect();
            console.error('Error obteniendo lista de procesos:', err);
            return res.status(500).json({ error: 'No se pudo obtener la lista de servicios' });
          }

          const nombres = list.map((proc) => proc.name);
          let pendientes = nombres.length;
          const resultados = [];

          nombres.forEach((servicio) => {
            pm2[accion](servicio, (err) => {
              if (err) {
                console.error(`Error al ${accion} servicio ${servicio}:`, err);
                resultados.push({ servicio, status: 'error', error: err.message });
              } else {
                resultados.push({ servicio, status: 'ok' });
              }

              if (--pendientes === 0) {
                pm2.disconnect();
                return res.json({
                  message: `Acción ${accion} ejecutada en todos los servicios`,
                  resultados,
                });
              }
            });
          });
        });
      } else {
        // Caso normal: aplicar acción a un solo servicio
        pm2[accion](name, (err) => {
          pm2.disconnect();

          if (err) {
            console.error(`Error al ${accion} servicio ${name}:`, err);
            return res.status(500).json({ error: `No se pudo ${accion} el servicio ${name}` });
          }

          return res.json({
            message: `Servicio ${name} ${accion} ejecutado correctamente`,
          });
        });
      }
    });
  });
 
// AÑADIR NUEVO SERVICIO A LA BASE DE DATOS
router.post('/services', async (req, res) => {
  try {
    const { name, script, cwd, port } = req.body;

    // 1. Conectar a PM2
    pm2.connect((err) => {
      if (err) {
        console.error('Error conectando con PM2:', err);
        return res.status(500).json({ error: 'No se pudo conectar a PM2' });
      }

      // 2. Opciones para levantar el servicio
      const startOptions = {
        script,
        name,
        cwd,
        env: {
          PORT: port || undefined,
        },
      };

      // 3. Intentar iniciar servicio en PM2
      pm2.start(startOptions, async (err) => {
        if (err) {
          pm2.disconnect();
          console.error(`Error al iniciar servicio ${name}:`, err);
          return res
            .status(500)
            .json({ error: `No se pudo iniciar el servicio ${name}` });
        }

        // 4. Verificar que el servicio realmente esté online
        pm2.describe(name, async (err, processDescription) => {
          if (err) {
            pm2.disconnect();
            console.error(`Error describiendo servicio ${name}:`, err);
            return res.status(500).json({ error: 'Error al verificar el estado del servicio' });
          }

          const proc = processDescription[0];
          const status = proc?.pm2_env?.status;

          if (status !== 'online') {
            // Si no está online, eliminarlo de PM2 y no guardar en BD
            pm2.delete(name, () => {
              pm2.disconnect();
              return res
                .status(400)
                .json({ error: `El servicio ${name} no se está ejecutando (estado: ${status})` });
            });
          } else {
            // 5. Guardar en la base de datos si está online
            try {
              const pool = await poolPromise;
              await pool
                .request()
                .input('name', sql.VarChar, name)
                .input('script', sql.VarChar, script)
                .input('cwd', sql.VarChar, cwd)
                .input('port', sql.Int, port)
                .query(
                  'INSERT INTO services (name, script, cwd, port) VALUES (@name, @script, @cwd, @port)'
                );

              pm2.disconnect();
              return res.status(201).json({
                message: `Servicio ${name} iniciado y guardado correctamente en la BD`,
              });
            } catch (dbErr) {
              pm2.disconnect();
              console.error('Error guardando en la BD:', dbErr);
              return res.status(500).json({ error: 'Error guardando servicio en la BD' });
            }
          }
        });
      });
    });
  } catch (err) {
    console.error('Error creando servicio:', err);
    res.status(500).json({ error: 'Error al crear el servicio' });
  }
});

  // ELIMINAR SERVICIO DE LA BASE DE DATOS Y PM2
  router.delete('/services/delete/:name', async (req, res) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Error conectando con PM2:', err);
        return res.status(500).json({ error: 'No se pudo conectar a PM2' });
      }
      pm2.delete(req.params.name, (err) => {
        pm2.disconnect();

        if (err) {
          console.error(`Error eliminando servicio ${req.params.name} de PM2:`, err);
          return res
            .status(500)
            .json({ error: `No se pudo eliminar el servicio ${req.params.name} de PM2` });
        }
      });
    });
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input('name', sql.VarChar, req.params.name)
        .query('DELETE FROM services WHERE name = @name');
      res.json({ message: 'Servicio eliminado correctamente de la BD y PM2' });
    } catch (err) { 
      console.error('Error eliminando servicio de la BD:', err);
      res.status(500).json({ error: 'No se pudo eliminar el servicio de la BD' });
    }
  });
  return router;
};
