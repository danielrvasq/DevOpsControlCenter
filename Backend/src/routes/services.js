// routes/services.js
import express from 'express';

export default ({ pm2 }) => {
  const router = express.Router();

  /* ==============================
        INICIAR/DETENER/REINICIAR SERVICIO CON PM2
    ================================ */
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

      pm2[accion](name, (err) => {
        pm2.disconnect();

        if (err) {
          console.error(`Error al ${accion} servicio:`, err);
          return res.status(500).json({ error: `No se pudo ${accion} el servicio` });
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
  router.get('/services/list', (req, res) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Error conectando con PM2:', err);
        return res.status(500).json({ error: 'No se pudo conectar a PM2' });
      }

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
          cwd: proc.pm2_env.pm_cwd,
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

  return router;
};
