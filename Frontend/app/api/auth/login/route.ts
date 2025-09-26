import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Simulación de autenticación - En producción usar hash de contraseñas
    const users = [
      { id: 1, username: "admin", password: "admin123", name: "Administrador", role: "Admin" },
      { id: 2, username: "dev", password: "dev123", name: "Desarrollador", role: "Developer" },
      { id: 3, username: "viewer", password: "viewer123", name: "Visualizador", role: "Viewer" },
    ]

    const user = users.find((u) => u.username === username && u.password === password)

    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // En producción, generar JWT token
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions:
        user.role === "Admin" ? ["read", "write", "admin"] : user.role === "Developer" ? ["read", "write"] : ["read"],
    }

    return NextResponse.json({ user: userData })
  } catch (error) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
