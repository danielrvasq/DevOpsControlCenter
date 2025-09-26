import { type NextRequest, NextResponse } from "next/server"

// Configuración del servidor de aplicaciones
const APPLICATION_SERVER = {
  host: "192.168.19.27",
  port: 3000,
  protocol: "http",
  timeout: 30000,
}

export async function GET() {
  // Simular obtención de servicios del servidor de aplicaciones
  const services = [
    {
      id: 1,
      name: "API Principal",
      type: "pm2",
      path: "C:\\Apps\\api-principal",
      command: "npm start",
      port: 3001,
      status: "running",
      server: APPLICATION_SERVER.host,
    },
    {
      id: 2,
      name: "Web App ERP",
      type: "iis",
      path: "C:\\inetpub\\wwwroot\\erp",
      command: "Default Web Site/ERP",
      port: 8080,
      status: "running",
      server: APPLICATION_SERVER.host,
    },
  ]

  return NextResponse.json({ services, server: APPLICATION_SERVER })
}

export async function POST(request: NextRequest) {
  try {
    const serviceData = await request.json()

    // Simular configuración de servicio en servidor remoto
    console.log(`Configuring service on ${APPLICATION_SERVER.host}:`, serviceData)

    const newService = {
      id: Date.now(),
      ...serviceData,
      status: "stopped",
      server: APPLICATION_SERVER.host,
    }

    return NextResponse.json({
      success: true,
      service: newService,
      message: `Servicio configurado en ${APPLICATION_SERVER.host}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al configurar servicio en servidor de aplicaciones",
      },
      { status: 500 },
    )
  }
}
