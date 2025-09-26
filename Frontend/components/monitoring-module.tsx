"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Globe,
  Clock,
  Activity,
  Trash2,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
interface Service {
  id: number;
  name: string;
  path: string;
  responseTime: number | null;
  availability: string;
  payloadSize: number | null;
  statusCode: number | null;
  lastCheck: string;
  status: "online" | "offline" | "warning";
}

export default function MonitoringModule() {
  const [services, setServices] = useState<Service[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Estados para el modal de crear API
  const [newApiName, setNewApiName] = useState("");
  const [newApiPath, setNewApiPath] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Icono para online/offline/warning
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "offline":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
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
  const canManageDelete = currentUser?.rol === "admin";
  const canManageCreate = currentUser?.rol === "developer";

  // Mostrar estadados en un Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Operativo
          </Badge>
        );
      case "offline":
        return <Badge variant="destructive">Caído</Badge>;
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            Lento
          </Badge>
        );
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };
  // Determinar el estado
  const determineStatus = (
    metrics: Service
  ): "online" | "offline" | "warning" => {
    if (
      metrics.availability === "Caído" ||
      metrics.availability === "Unavailable" ||
      metrics.statusCode !== 200
    ) {
      return "offline";
    }
    if (metrics.responseTime && metrics.responseTime > 500) {
      return "warning";
    }
    return "online";
  };

  /*=============================
    CALCULAR METRICAS
===============================*/

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("http://localhost:3001/api/monitor/apis");
      const data: Service[] = await response.json();

      const mapped = data.map((api) => ({
        ...api,
        status: determineStatus(api),
        lastCheck: new Date(api.lastCheck).toLocaleString("es-ES"),
      }));

      setServices(mapped);
    } catch (error) {
      console.error("Error fetching API metrics:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  /*=============================
    ADMINISTAR API
===============================*/
  // Crear una nueva api
  const handleCreateApi = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newApiName, path: newApiPath }),
      });

      if (!res.ok) {
        console.error("Error creando API");
        return;
      }

      setNewApiName("");
      setNewApiPath("");
      setIsDialogOpen(false);
      await handleRefresh();
    } catch (error) {
      console.error("Error creando API:", error);
    }
  };

  // Eliminar una api
  const handleDeleteApi = async (apiId: number) => {
    try {
      const res = await fetch(`http://localhost:3001/api/apis/${apiId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.error("Error eliminando la api");
        return;
      }

      await handleRefresh(); // refrescar lista
    } catch (error) {
      console.error("Error eliminando la api:", error);
    }
  };

  // ==============================
  // Contadores
  // ==============================
  const onlineServices = services.filter((s) => s.status === "online").length;
  const offlineServices = services.filter((s) => s.status === "offline").length;
  const warningServices = services.filter((s) => s.status === "warning").length;

  // Cargar al inicio
  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Monitoreo de Servicios
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Estado en tiempo real de aplicaciones y APIs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Actualizar</span>
          </Button>

          {/* Botón + Modal para crear API */}

          {(canManageDelete || canManageCreate) && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Nueva API</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="p-6 rounded-xl shadow-lg">
                <DialogHeader>
                  <DialogTitle>Agregar nueva API</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium">Nombre</label>
                    <Input
                      value={newApiName}
                      onChange={(e) => setNewApiName(e.target.value)}
                      placeholder="Ejemplo: API Usuarios"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ruta</label>
                    <Input
                      value={newApiPath}
                      onChange={(e) => setNewApiPath(e.target.value)}
                      placeholder="https://ejemplo.com/api"
                    />
                  </div>
                  <Button onClick={handleCreateApi} className="w-full">
                    Guardar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {onlineServices}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Operativos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {offlineServices}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Caídos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {warningServices}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Con Alertas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {services.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => (
          <Card key={service.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription>{service.path}</CardDescription>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <Globe className="h-4 w-4" />
                  <span>{service.path}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tiempo de Respuesta</span>
                    <span
                      className={
                        service.status === "warning"
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {service.responseTime
                        ? `${service.responseTime}ms`
                        : "N/A"}
                    </span>
                  </div>
                  <Progress
                    value={
                      service.responseTime
                        ? Math.min(100, (1000 - service.responseTime) / 10)
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Disponibilidad</span>
                    <span className="text-blue-600">
                      {service.availability === "Operativo" ||
                      service.availability === "Available"
                        ? "100%"
                        : "0%"}
                    </span>
                  </div>
                  <Progress
                    value={
                      service.availability === "Operativo" ||
                      service.availability === "Available"
                        ? 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="flex justify-between text-sm">
                  <span>Tamaño de la Carga</span>
                  <span className="text-blue-600">
                    {service.payloadSize ? `${service.payloadSize} KB` : "N/A"}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Última verificación: {service.lastCheck || "N/A"}</span>
                </div>
                {canManageDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteApi(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
