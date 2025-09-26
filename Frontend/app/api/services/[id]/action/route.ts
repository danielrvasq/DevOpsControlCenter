import { type NextRequest, NextResponse } from "next/server"

const APPLICATION_SERVER = {
  host: "192.168.1.100",
  port: 3000,
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { action } = await request.json()
    const serviceId = Number.parseInt(params.id)

    // Simular ejecución de comando en servidor de aplicaciones
    console.log(`Executing ${action} on ${APPLICATION_SERVER.host} for service ${serviceId}`)

    let result = { success: false, message: "" }

    switch (action) {
      case "start":
        // Ejecutar: ssh admin@192.168.1.100 "pm2 start app.js" o "Start-WebApplication"
        result = {
          success: true,
          message: `Servicio iniciado en ${APPLICATION_SERVER.host}`,
        }
        break
      case "stop":
        // Ejecutar: ssh admin@192.168.1.100 "pm2 stop app.js" o "Stop-WebApplication"
        result = {
          success: true,
          message: `Servicio detenido en ${APPLICATION_SERVER.host}`,
        }
        break
      case "restart":
        // Ejecutar: ssh admin@192.168.1.100 "pm2 restart app.js" o "Restart-WebApplication"
        result = {
          success: true,
          message: `Servicio reiniciado en ${APPLICATION_SERVER.host}`,
        }
        break
      default:
        result = {
          success: false,
          message: "Acción no reconocida",
        }
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error al ejecutar acción en ${APPLICATION_SERVER.host}`,
      },
      { status: 500 },
    )
  }
}
