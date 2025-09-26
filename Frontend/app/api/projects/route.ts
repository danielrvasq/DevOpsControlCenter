import { type NextRequest, NextResponse } from "next/server"

// Configuración del servidor de repositorios
const REPOSITORY_SERVER = {
  host: "192.168.1.101",
  port: 22,
  username: "git",
  basePath: "/repositories",
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json()

    // Simular creación de repositorio en servidor remoto
    const serverPath = `${REPOSITORY_SERVER.basePath}/${name.toLowerCase().replace(/\s+/g, "-")}.git`

    // Aquí se ejecutaría el comando SSH real:
    // ssh git@192.168.1.101 "git init --bare /repositories/proyecto.git"

    console.log(`Creating repository at ${REPOSITORY_SERVER.host}:${serverPath}`)

    const project = {
      id: Date.now(),
      name,
      description,
      serverPath,
      cloneUrl: `${REPOSITORY_SERVER.username}@${REPOSITORY_SERVER.host}:${serverPath}`,
      created: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      project,
      message: `Repositorio creado en ${REPOSITORY_SERVER.host}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al crear proyecto en servidor de repositorios",
      },
      { status: 500 },
    )
  }
}
