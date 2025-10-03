import express from 'express';
import bcrypt from 'bcryptjs';

export default ({ poolPromise, sql }) => {
  const router = express.Router();

  // LOGIN
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
      const pool = await poolPromise;

      // 1. Buscar usuario por username
      const result = await pool
        .request()
        .input('username', sql.VarChar, username)
        .query(`
          SELECT id, name, username, email, rol, state, lastAccess, password
          FROM Users
          WHERE username = @username
        `);

      if (result.recordset.length === 0) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }

      const user = result.recordset[0];

      // 2. Comparar contraseña en texto plano con el hash
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }

      // 3. Actualizar lastAccess
      await pool.request().input('id', sql.Int, user.id).query(`
        UPDATE Users
        SET lastAccess = GETDATE()
        WHERE id = @id
      `);

      // 4. Devolver usuario sin contraseña
      const { password: _, ...safeUser } = user;
      res.json({ ...safeUser, lastAccess: new Date() });

    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });

  return router;
};
