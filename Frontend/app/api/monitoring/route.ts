import { NextResponse } from "next/server"

export async function GET() {
  // Simulación de verificación de servicios
  const services = [
    {
      id: 1,
      name: "API Principal",
      url: "http://localhost:3001",
      status: "online",
      responseTime: Math.floor(Math.random() * 200) + 20,
      uptime: 99.8,
    },
    {
      id: 2,
      name: "Web App ERP",
      url: "http://localhost:8080",
      status: "online",
      responseTime: Math.floor(Math.random() * 300) + 50,
      uptime: 98.5,
    },
    {
      id: 3,
      name: "API Gateway",
      url: "http://localhost:3002",
      status: Math.random() > 0.7 ? "offline" : "online",
      responseTime: Math.floor(Math.random() * 500) + 100,
      uptime: 95.2,
    },
  ]

  return NextResponse.json({ services })
}
