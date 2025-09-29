import express from 'express';

/*=======
Auth routes
==========*/
export default ({ poolPromise, sql }) => {
  const router = express.Router();

  /*=======
  POST /api/login
  ==========*/
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input('username', sql.VarChar, username)
        .input('password', sql.VarChar, password).query(`
          SELECT id, name, username, email, rol, state, lastAccess
          FROM Users
          WHERE username = @username AND password = @password
        `);

      if (result.recordset.length === 0) {
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }

      const user = result.recordset[0];

      await pool.request().input('id', sql.Int, user.id).query(`
        UPDATE Users
        SET lastAccess = GETDATE()
        WHERE id = @id
      `);

      res.json({ ...user, lastAccess: new Date() });
    } catch (err) {
      console.error('Error en login:', err);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });

  return router;
};
