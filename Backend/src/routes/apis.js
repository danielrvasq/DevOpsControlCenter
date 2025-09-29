// routes/apis.js
import express from 'express';

export default ({ poolPromise, sql, https }) => {
    const router = express.Router();

    /* ==============================
        CREAR NUEVA API
    ================================ */

    router.post('/apis', async (req, res) => {
        try {
            const { name, path } = req.body;

            if (!name || !path) {
                return res
                    .status(400)
                    .json({ error: 'Faltan campos requeridos: name, path' });
            }

            const pool = await poolPromise;

            await pool
                .request()
                .input('name', sql.NVarChar, name)
                .input('path', sql.NVarChar, path).query(`
                    INSERT INTO Apis (name, path)
                    VALUES (@name, @path)
                `);

            res.status(201).json({ message: 'API creada exitosamente' });
        } catch (err) {
            console.error('Error creando API:', err);
            res.status(500).json({ error: 'No se pudo crear la API' });
        }
    });

    /* ==============================
        ELIMINAR API
    ================================ */

    router.delete('/apis/:id', async (req, res) => {
        const { id } = req.params;

        try {
            const pool = await poolPromise; 

            await pool
                .request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Apis WHERE id = @id');

            res.json({ message: 'API eliminada correctamente' });
        } catch (err) {
            console.error('Error eliminando la API:', err);
            res.status(500).json({ error: 'No se pudo eliminar la API' });
        }
    });

    /* ==============================
        MONITOREO DE APIS
    ================================ */

    router.get('/monitor/apis', async (req, res) => {
        try {
            const pool = await poolPromise;

            const result = await pool
                .request()
                .query('SELECT id, name, path FROM Apis');

            const apisToMonitor = result.recordset;

            if (apisToMonitor.length === 0) {
                return res.status(200).json([]);
            }

            const monitoringPromises = apisToMonitor.map(async (api) => {
                const { id, name, path } = api;

                const startTime = process.hrtime();

                try {
                    const data = await new Promise((resolve, reject) => {
                        // Se usa 'https' para todas las URLs. 
                        const client = https;
                        
                        const req = client.get(path, (apiRes) => {
                            const { statusCode } = apiRes;

                            let responseData = '';

                            if (statusCode < 200 || statusCode >= 300) {
                                reject(
                                    new Error(`Request Failed with Status Code: ${statusCode}`)
                                );
                                return;
                            }

                            apiRes.on('data', (chunk) => (responseData += chunk));
                            apiRes.on('end', () => resolve(responseData));
                        });

                        req.on('error', (err) => reject(err));
                    });

                    const endTime = process.hrtime(startTime);
                    const responseTimeMs = (endTime[0] * 1e9 + endTime[1]) / 1e6;
                    const payloadSizeKB = Buffer.byteLength(data) / 1024;

                    return {
                        id,
                        name,
                        path,
                        responseTime: parseFloat(responseTimeMs.toFixed(2)),
                        availability: 'Operativo',
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
                        availability: 'Caído',
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
            console.error('Error monitoring APIs:', err);
            res.status(500).json({ error: 'Could not fetch and monitor APIs' });
        }
    });

    return router;
};