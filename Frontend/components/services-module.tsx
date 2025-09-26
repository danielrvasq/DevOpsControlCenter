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
import { Server, Zap, Network, Square, RefreshCw, Play } from "lucide-react";
import { Button } from "./ui/button";

export default function ServicesModule() {
  const [services, setServices] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const applicationServer = {
    host: "192.168.19.27",
    port: 3000,
  };

  // administrar permisos de usuario
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

  // Muestra el estado del servicio en un Badge
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
      case "error":
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

/*=============================
    ADMINISTAR SERVICIOS CON COMANDOS PM2 
===============================*/

  // Cargar servicios disponibles
  const loadServices = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/services/list");
      const data = await res.json();

      const services = data.map((row: any) => ({
        id: row.pm_id,
        name: row.name,
        status: row.status,
        path: row.cwd,
        type: row.type ?? "pm2",
        port: row.port,
      }));
      setServices(services);
    } catch (e) {
      console.log("Error loading services: ", e);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Ejecutar start/stop/restart de todos los servicios
  const handleAll = async (accion: string) => {
    try {
      // recorrer todos los servicios y llamar al backend
      for (const service of services) {
        await fetch(
          `http://localhost:3001/api/services/${accion}/${service.name}`,
          {
            method: "POST",
          }
        );
      }
      // refrescar lista al terminar
      await loadServices();
    } catch (err) {
      console.error("Error al iniciar todos los servicios:", err);
    }
  };

  // Ejecutar start/stop/restart de un determinado servicio 
  const handleService = async (accion: string, name: string) => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/services/${accion}/${name}`,
        {
          method: "POST",
        }
      );
      const data = await res.json();

      if (res.ok) {
        console.log(data.message);
        // refrescar lista de servicios después de ejecutar la acción
        await loadServices();
      } else {
        console.error(data.error);
      }
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
          Lista de procesos obtenidos desde el backend
        </p>
      </div>

      {/* Server Info */}
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
            <Network className="h-5 w-5" />
            <span>Servidor de Aplicaciones</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                Host
              </p>
              <p className="text-green-600 dark:text-green-400">
                {applicationServer.host}:{applicationServer.port}
              </p>
            </div>
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                Protocolo
              </p>
              <p className="text-green-600 dark:text-green-400"></p>
            </div>
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">
                Timeout
              </p>
              <p className="text-green-600 dark:text-green-400"></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Master Controls */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Controles Maestros</CardTitle>
            <CardDescription>
              Gestiona todos los servicios en {applicationServer.host}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Button
                className="flex items-center space-x-2"
                onClick={() => handleAll("start")}
              >
                <Play className="h-4 w-4" />

                <span>Iniciar Todo</span>
              </Button>
              <Button
                onClick={() => handleAll("restart")}
                variant="outline"
                className="flex items-center space-x-2 bg-transparent"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reiniciar Todo</span>
              </Button>
              <Button
                onClick={() => handleAll("stop")}
                variant="destructive"
                className="flex items-center space-x-2"
              >
                <Square className="h-4 w-4" />
                <span>Detener Todo</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => (
          <Card key={service.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(service.type)}
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription>
                      {service.type.toUpperCase()} • Puerto {service.port}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>Ruta:</strong> {service.path}
                </p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2">
                <Network className="h-3 w-3 inline mr-1" />
                Servidor: {applicationServer.host}
              </div>
              {canManage &&
              <div className="flex items-center mt-3 gap-2">
                <Button
                  className="flex items-center  space-x-2"
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
                }
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
