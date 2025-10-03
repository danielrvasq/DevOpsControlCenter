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
  FileCode,
  Hash,
  Repeat,
  Folder,
  Power,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { DialogContent } from "./ui/dialog";
import {
  Dialog,
  DialogDescription,
  DialogTrigger,
} from "@radix-ui/react-dialog";
import { DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "recharts";
import { Input } from "./ui/input";

export default function ServicesModule() {
  const [services, setServices] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newService, setNewService] = useState({
    script: "",
    name: "",
    cwd: "",
    port: "",
  });

  const applicationServer = {
    host: "192.168.19.27",
    port: 3000,
  };

  //los admins pueden hacer todo
  //los developer no pueden detener,crear o eliminar servicios
  //los viewer solo pueden ver
  // DETERMINAR LOS PERMISOS

  // const canManage = currentUser?.rol === "developer";
  const canAdmin = currentUser?.rol === "admin";
  const canDev = currentUser?.rol === "developer";

  // CARGAR USUARIO DESDE LOCALSTORAGE
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

  // FUNCION PARA OBTENER EL BADGE DE ESTADO
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

  // FUNCION PARA OBTENER EL ICONO SEGUN TIPO DE SERVICIO
  const getTypeIcon = (type: string) => {
    return type === "iis" ? (
      <Server className="h-4 w-4" />
    ) : (
      <Zap className="h-4 w-4" />
    );
  };

  // FUNCION PARA CARGAR SERVICIOS
  const loadServices = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/services/list");
      const data = await res.json();
      setServices(data);
    } catch (e) {
      console.log("Error loading services: ", e);
    }
  };

  
  // FUNCION PARA LEVANTAR SERVICIOS
  const handlePower = async () => {
    try {
      const confirmPower = window.confirm(
        `¿Estás seguro de que deseas encender el servidor de aplicaciones? Esto iniciará todos los servicios registrados en PM2.`
      );
      if (!confirmPower) {
        return; // cancelar la acción
      }
      const res = await fetch(`http://localhost:3001/api/services/start-db`, {
        method: "POST",
      });
      if (res.ok) await loadServices();
    } catch (err) {
      console.error("Error ejecutando acción:", err);
    }
  };
  
  // FUNCION PARA GESTIONAR SERVICIOS (START, RESTART, STOP)
  const handleService = async (accion: string, name: string) => {
    try {

      if ((accion == "stop" || accion == "restart") && name !== "all") {
        const confirmAction = window.confirm(
          `¿Estás seguro de que deseas ${accion} el servicio "${name}"?`
        );
        if (!confirmAction) {
          return; // cancelar la acción
        }
      }else if((accion == "stop" || accion == "restart") && name === "all"){
        const confirmAction = window.confirm(
          `¿Estás seguro de que deseas ${accion} todos los servicios?`
        );
        if (!confirmAction) {
          return; // cancelar la acción
        }
      }
      const res = await fetch(
        `http://localhost:3001/api/services/${accion}/${name}`,
        { method: "POST" }
      );
      if (res.ok) await loadServices();
    } catch (err) {
      console.error("Error ejecutando acción:", err);
    }
  };
  
  // FUNCION PARA CREAR NUEVO SERVICIO
  const handleNewService = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });
      if (res.ok) await handlePower();
      {
        setNewService({ script: "", name: "", cwd: "", port: "" });
        await loadServices();
      }
    } catch (error) {
      console.error("Error creando servicio:", error);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // FUNCION PARA ELIMINAR SERVICIOS DE PM2 Y LA BASE DE DATOS
  const handleDeleteService = async (name: string) => {
    
    try {
      const confirmDelete = window.confirm(
        `¿Estás seguro de que deseas eliminar el servicio "${name}"?`
      );

      if (!confirmDelete) {
        return; // cancelar la eliminación
      }
      const res = await fetch(
        `http://localhost:3001/api/services/delete/${name}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) await loadServices();
    } catch (err) {
      console.error("Error eliminando servicio:", err);
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
          <Button
              variant="outline"
              onClick={() => loadServices()}
              className="flex items-center space-x-2 bg-transparent"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Actualizar Lista</span>
            </Button>
        </p>
        <div className="flex items-center mt-3 gap-2">
          <Dialog>
            <DialogTrigger asChild>
              {canAdmin && (
                <Button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <Network className="h-4 w-4" />
                  <span>Nuevo Servicio</span>
                </Button>
              )}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Servicio</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo servicio al sistema
                </DialogDescription>
              </DialogHeader>
              {/* FORMULARIO */}
              <form onSubmit={handleNewService} className="space-y-4">
                <div>
                  <Label>Script</Label>
                  <Input
                    placeholder="C:/Users/.../app.js"
                    value={newService.script}
                    onChange={(e) =>
                      setNewService((p) => ({ ...p, script: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Nombre</Label>
                  <Input
                    placeholder="servicioPrueba1"
                    value={newService.name}
                    onChange={(e) =>
                      setNewService((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Path</Label>
                  <Input
                    placeholder="C:/Users/.../carpeta"
                    value={newService.cwd}
                    onChange={(e) =>
                      setNewService((p) => ({ ...p, cwd: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Puerto</Label>
                  <Input
                    type="number"
                    placeholder="4001"
                    value={newService.port}
                    onChange={(e) =>
                      setNewService((p) => ({ ...p, port: e.target.value }))
                    }
                    required
                    min={1}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Crear Servicio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {(canAdmin || canDev) && (
            <Button
              className="flex items-center space-x-2 color-white bg-green-600 hover:bg-green-700"
              onClick={() => handlePower()}
            >
              <Power className="h-4 w-4" />
              <span>Encender</span>
            </Button>
          )}
          {(canAdmin || canDev) && (
            <Button
              className="flex items-center space-x-2"
              onClick={() => handleService("start", "all")}
            >
              <Play className="h-4 w-4" />
              <span>Iniciar</span>
            </Button>
          )}

          {canAdmin && (
            <Button
              variant="outline"
              onClick={() => handleService("restart", "all")}
              className="flex items-center space-x-2 bg-transparent"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reiniciar</span>
            </Button>
          )}
          
          {canAdmin && (
            <Button
              variant="destructive"
              onClick={() => handleService("stop", "all")}
              className="flex items-center space-x-2"
            >
              <Square className="h-4 w-4" />
              <span>Detener</span>
            </Button>
          )}
        </div>
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
                  <Folder className="inline h-4 w-4 mr-1" />{" "}
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

              {(canAdmin || canDev) && (
                <div className="flex items-center mt-3 gap-2">
                  {(canAdmin || canDev) && (
                    <Button
                      className="flex items-center space-x-2"
                      onClick={() => handleService("start", service.name)}
                    >
                      <Play className="h-4 w-4" />
                      <span>Iniciar</span>
                    </Button>
                  )}
                  {canAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => handleService("restart", service.name)}
                      className="flex items-center space-x-2 bg-transparent"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Reiniciar</span>
                    </Button>
                  )}
                  {canAdmin && (
                    <Button
                      variant="destructive"
                      onClick={() => handleService("stop", service.name)}
                      className="flex items-center space-x-2"
                    >
                      <Square className="h-4 w-4" />
                      <span>Detener</span>
                    </Button>
                  )}
                  {canAdmin && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteService(service.name)}
                      className="flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Eliminar</span>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
