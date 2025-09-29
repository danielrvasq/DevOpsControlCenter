"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Zap,
  Network,
  Square,
  RefreshCw,
  Play,
  Activity,
  Cpu,
  Clock,
  FileCode,
  Hash,
  Repeat,
} from "lucide-react";
import { Button } from "./ui/button";

export default function ServicesModule() {
  const [services, setServices] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const applicationServer = {
    host: "192.168.19.27",
    port: 3000,
  };

  useEffect(() => {
    async function fetchUser() {
      const storedUser = localStorage.getItem("currentUser");
      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);

      try {
        const res = await fetch(
          `http://localhost:3001/api/users/${parsedUser.id}`
        );
        if (!res.ok) throw new Error("Error obteniendo al usuario");
        const userData = await res.json();

        setCurrentUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("currentUser", JSON.stringify(userData));
      } catch (e) {
        console.error("Error cargando usuario", e);
      }
    }

    fetchUser();
  }, []);

  const canManage =
    currentUser?.rol === "admin" || currentUser?.rol === "developer";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Ejecutándose
          </Badge>
        );
      case "stopped":
        return <Badge variant="secondary">Detenido</Badge>;
      case "errored":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "iis" ? (
      <Server className="h-4 w-4" />
    ) : (
      <Zap className="h-4 w-4" />
    );
  };

  const loadServices = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/services/list");
      const data = await res.json();
      setServices(data);
    } catch (e) {
      console.log("Error loading services: ", e);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleService = async (accion: string, name: string) => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/services/${accion}/${name}`,
        { method: "POST" }
      );
      if (res.ok) await loadServices();
    } catch (err) {
      console.error("Error ejecutando acción:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Servicios en {applicationServer.host}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Lista de procesos obtenidos desde PM2
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => (
          <Card
            key={service.pm_id}
            className="hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon("pm2")}
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription>
                      ID {service.pm_id} • Puerto {service.port || "N/A"}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <p>
                  <Hash className="inline h-4 w-4 mr-1" /> <strong>ID:</strong>{" "}
                  {service.pm_id}
                </p>
                <p>
                  <FileCode className="inline h-4 w-4 mr-1" />{" "}
                  <strong>Script:</strong> {service.script}
                </p>
                <p>
                  <Server className="inline h-4 w-4 mr-1" />{" "}
                  <strong>Ruta:</strong> {service.cwd}
                </p>
                <p>
                  <Activity className="inline h-4 w-4 mr-1" />{" "}
                  <strong>Instancias:</strong> {service.instances}
                </p>
                <p>
                  <Cpu className="inline h-4 w-4 mr-1" /> <strong>CPU:</strong>{" "}
                  {service.cpu}%
                </p>
                <p>
                  <Activity className="inline h-4 w-4 mr-1" />{" "}
                  <strong>Memoria:</strong> {service.memory} MB
                </p>
                <p>
                  <Repeat className="inline h-4 w-4 mr-1" />{" "}
                  <strong>Reinicios:</strong> {service.restartCount}
                </p>
              </div>

              {canManage && (
                <div className="flex items-center mt-3 gap-2">
                  <Button
                    className="flex items-center space-x-2"
                    onClick={() => handleService("start", service.name)}
                  >
                    <Play className="h-4 w-4" />
                    <span>Iniciar</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleService("restart", service.name)}
                    className="flex items-center space-x-2 bg-transparent"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reiniciar</span>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleService("stop", service.name)}
                    className="flex items-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>Detener</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
