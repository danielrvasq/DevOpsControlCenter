"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  Server,
  Users,
  CheckCircle,
  XCircle,
  Monitor,
  Code,
  Shield,
} from "lucide-react";
import ProjectsModule from "@/components/projects-module";
import MonitoringModule from "@/components/monitoring-module";
import ServicesModule from "@/components/services-module";
import UsersModule from "@/components/users-module";
import LoginForm from "@/components/login-form";
import { ModeToggle } from "@/components/mode-toggle";

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeServices: 0,
    failedServices: 0,
    totalUsers: 0,
  });

  // Al cargar, verifica si hay usuario en localStorage y actualiza desde backend para no cerrar sesion al re cargar la pagina
  useEffect(() => {
    async function fetchUser() {
      const storedUser = localStorage.getItem("currentUser");
      if (!storedUser) return;

      const parsedUser = JSON.parse(storedUser);

      try {
        const res = await fetch(
          `http://localhost:3001/api/users/${parsedUser.id}`
        );
        if (!res.ok) throw new Error("Error obteniendo usuario");
        const userData = await res.json();

        setCurrentUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("currentUser", JSON.stringify(userData));
      } catch (err) {
        console.error("Error cargando usuario:", err);
      }
    }

    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch("http://localhost:3001/api/monitor/apis");
        if (!res.ok) throw new Error("Error obteniendo servicios");

        const data = await res.json();

        // Contar servicios activos y caidos reales
        const online = data.filter(
          (s) => s.availability === "Operativo"
        ).length;
        const offline = data.filter((s) => s.availability === "Caído").length;

        setStats((prev) => ({
          ...prev,
          activeServices: online,
          failedServices: offline,
        }));
      } catch (err) {
        console.error("Error cargando servicios:", err);
      }
    }

    fetchServices();
  }, []);

  // contar proyectos totales
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("http://localhost:3001/api/projects");
        if (!res.ok) throw new Error("Error obteniendo proyectos");
        const files: string[] = await res.json();

        setStats((prev) => ({
          ...prev,
          totalProjects: files.length,
        }));
      } catch (err) {
        console.error("Error cargando proyectos:", err);
      }
    }

    fetchProjects();
  }, []);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem("currentUser", JSON.stringify(userData));
  };

  // cerrar sesion
  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("currentUser");
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <GitBranch className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                DevOps Control Center
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm">
              {currentUser?.rol || "Developer"}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {currentUser?.name || "Usuario"}
            </span>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Proyectos Totales
              </CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Servicios Activos
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.activeServices}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Servicios Caídos
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failedServices}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger
              value="projects"
              className="flex items-center space-x-2"
            >
              <GitBranch className="h-4 w-4" />
              <span>Proyectos</span>
            </TabsTrigger>
            <TabsTrigger
              value="monitoring"
              className="flex items-center space-x-2"
            >
              <Monitor className="h-4 w-4" />
              <span>Monitoreo</span>
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="flex items-center space-x-2"
            >
              <Server className="h-4 w-4" />
              <span>Servicios</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Usuarios</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <ProjectsModule currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="monitoring">
            <MonitoringModule />
          </TabsContent>

          <TabsContent value="services">
            <ServicesModule />
          </TabsContent>

          <TabsContent value="users">
            <UsersModule currentUser={currentUser} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
