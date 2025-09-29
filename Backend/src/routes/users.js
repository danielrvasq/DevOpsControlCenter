// routes/users.js
import express from 'express';

export default ({ poolPromise, sql }) => {
  const router = express.Router();

  /* ==============================
        MANEJO DE USUARIOS
    ================================ */

  router.get('/users', async (req, res) => {
    try {
      const pool = await poolPromise;

      const result = await pool.request().query(`
                SELECT id, name, username, email, rol, state,
                      FORMAT(lastAccess, 'yyyy-MM-dd HH:mm:ss') AS lastAccess
                FROM Users
            `);

      res.json(result.recordset);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Could not fetch users' });
    }
  });

  router.get('/users/:id', async (req, res) => {
    try {
      const pool = await poolPromise;

      const result = await pool.request().input('id', sql.Int, req.params.id).query(`
                    SELECT id, name, username, email, rol, state, lastAccess
                    FROM Users
                    WHERE id = @id
                `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.json(result.recordset[0]);
    } catch (err) {
      console.error('Error en /api/users/:id:', err);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const pool = await poolPromise;

      await pool
        .request()
        .input('id', sql.Int, req.params.id)
        .query('DELETE FROM Users WHERE id = @id');

      res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
      console.error('Error eliminando usuario:', err);
      res.status(500).json({ error: 'No se pudo eliminar el usuario' });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const { name, username, email, password, rol } = req.body;

      const pool = await poolPromise;

      await pool
        .request()
        .input('name', sql.VarChar, name)
        .input('username', sql.VarChar, username)
        .input('email', sql.VarChar, email)
        .input('password', sql.VarChar, password)
        .input('rol', sql.VarChar, rol).query(`
                    INSERT INTO Users (name, username, email, password, rol, state, lastAccess)
                    VALUES (@name, @username, @email, @password, @rol, DEFAULT, NULL)
                `);

      res.status(201).json({ message: 'Usuario creado exitosamente' });
    } catch (err) {
      console.error('Error creando usuario:', err);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, username, password, rol } = req.body;

      const pool = await poolPromise;

      // Verificar que el usuario exista
      const existing = await pool
        .request()
        .input('id', sql.Int, id)
        .query('SELECT id FROM Users WHERE id = @id');

      if (existing.recordset.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Actualizar solo los campos permitidos
      await pool
        .request()
        .input('id', sql.Int, id)
        .input('name', sql.VarChar, name || null)
        .input('username', sql.VarChar, username || null)
        .input('password', sql.VarChar, password || null)
        .input('rol', sql.VarChar, rol || null).query(`
                    UPDATE Users
                    SET
                        name = ISNULL(@name, name),
                        username = ISNULL(@username, username),
                        password = ISNULL(@password, password),
                        rol = ISNULL(@rol, rol)
                    WHERE id = @id
                `);

      res.json({ message: 'Usuario actualizado correctamente' });
    } catch (err) {
      console.error('Error actualizando usuario:', err);
      res.status(500).json({ error: 'No se pudo actualizar el usuario' });
    }
  });

  return router;
};
