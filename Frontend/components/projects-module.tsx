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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Calendar, User, Database, Trash2, Layers } from "lucide-react";

interface ProjectsModuleProps {
  currentUser: any;
}

export default function ProjectsModule({ currentUser }: ProjectsModuleProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canManage, setCurrentUser] = useState(null);

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
  const canManageDelete = canManage?.rol === "admin";
  const canManageDowload = canManage?.rol === "developer";

  /*=============================
    FUNCIONES PARA ADMINISTRAR PROYECTOS
===============================*/
  // Cargar proyectos
  const loadProjects = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/projects");
      const data = await res.json();

      const projects = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || "Proyecto detectado en base de datos",
        lastCommit: row.date
          ? new Date(row.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        author: row.ownerName || "Desconocido",
        status: "Activo",
        serverPath: row.path,
        versionNumber: row.versionNumber || "1",
      }));

      setProjects(projects);
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  };

  // Cargar versiones de un proyecto
  const loadVersions = async (projectId: number) => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${projectId}/versions`
      );
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Subir nuevo proyecto
  // Subir nuevo proyecto
  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      console.error("No se seleccionaron archivos");
      return;
    }

    const formData = new FormData();

    // clave: usar webkitRelativePath
    selectedFiles.forEach((file) => {
      formData.append(
        "files",
        file,
        (file as any).webkitRelativePath || file.name
      );
    });

    formData.append("name", projectName || "ProyectoSinNombre");
    formData.append("description", projectDescription || "");
    formData.append("owner", String(currentUser?.id || "1"));
    formData.append("date", new Date().toISOString());

    try {
      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload failed");
      }

      await res.json();
      alert("Proyecto subido correctamente!");
      setProjectName("");
      setProjectDescription("");
      setSelectedFiles([]);
      loadProjects();
    } catch (err) {
      console.error("Error uploading:", err);
      alert("Error subiendo el proyecto");
    }
  };

  // Subir nueva versión
  const handleUploadVersion = async (projectId: number) => {
    const projectToUpdate = projects.find((p) => p.id === projectId);

    if (selectedFiles.length === 0 || !projectToUpdate) return;

    const formData = new FormData();

    // igual que arriba, enviar ruta relativa
    selectedFiles.forEach((file) => {
      formData.append(
        "files",
        file,
        (file as any).webkitRelativePath || file.name
      );
    });

    formData.append("name", projectToUpdate.name);
    formData.append("description", projectToUpdate.description || "");
    formData.append("owner", String(currentUser?.id || "1"));
    formData.append("date", new Date().toISOString());

    try {
      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload version failed");
      }

      alert("Nueva versión subida correctamente!");
      loadProjects();
      if (selectedProject) loadVersions(selectedProject.id);
    } catch (err) {
      console.error(err);
      alert("Error subiendo nueva versión. Revisa la consola.");
    }
  };

  // Borrar proyecto
  const handleDeleteProject = async (
    projectId: number,
    projectName: string
  ) => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${projectId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        console.error("Error deleting project");
        return;
      }

      await loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  // Descargar version de un proyecto
  const handleDownload = (projectId: any, versionNumber: any) => {
    const url = `http://localhost:3001/api/projects/${projectId}/versions/${versionNumber}/download`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Proyectos
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Lista de proyectos detectados en el servidor
        </p>
      </div>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-gray-500">No hay proyectos disponibles</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    {project.name}
                    <Badge variant="outline">v{project.versionNumber}</Badge>
                  </CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" /> {project.author}
                  </p>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Última actualización:{" "}
                    {project.lastCommit}
                  </p>
                  <p className="text-sm flex items-center gap-2">
                    <Database className="w-4 h-4" /> Ruta: {project.serverPath}
                  </p>
                  <div className="flex gap-2">
                    {canManageDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          handleDeleteProject(project.id, project.name)
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        {(canManageDelete || canManageDowload) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProject(project);
                              loadVersions(project.id);
                            }}
                          >
                            <Layers className="w-4 h-4" />
                          </Button>
                        )}
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Versiones de {project.name}</DialogTitle>
                        </DialogHeader>
                        {versions.length === 0 ? (
                          <p className="text-gray-500">No hay versiones</p>
                        ) : (
                          <ul className="space-y-2">
                            {versions.map((v: any) => (
                              <li
                                key={v.id}
                                className="flex justify-between border-b py-1"
                              >
                                <span>
                                  v{v.version} -{" "}
                                  {new Date(v.uploadDate).toLocaleDateString()}
                                </span>
                                <button
                                  onClick={() =>
                                    handleDownload(project.id, v.versionNumber)
                                  } // <-- Pasar ambos
                                >
                                  Descargar v{v.versionNumber}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-4 space-y-2">
                          <Label>Subir nueva versión</Label>
                          <input
                            type="file"
                            // @ts-ignore
                            webkitdirectory=""
                            directory=""
                            multiple
                            onChange={(e) =>
                              setSelectedFiles(
                                e.target.files ? Array.from(e.target.files) : []
                              )
                            }
                          />
                          <Button
                            onClick={() => handleUploadVersion(project.id)}
                            className="w-full"
                          >
                            Subir Versión
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      {/* Quick Actions */}
      {(canManageDelete || canManageDowload) && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2 bg-transparent"
                  >
                    <Upload className="h-6 w-6" />
                    <span>Upload Code</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Project</DialogTitle>
                    <DialogDescription>
                      Completa la información del proyecto y selecciona la
                      carpeta a subir.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div>
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="projectDescription">Description</Label>
                      <Textarea
                        id="projectDescription"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Select Folder</Label>
                      <input
                        type="file"
                        // @ts-ignore
                        webkitdirectory=""
                        directory=""
                        multiple
                        required
                        onChange={(e) =>
                          setSelectedFiles(
                            e.target.files ? Array.from(e.target.files) : []
                          )
                        }
                      />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      User: {currentUser.name} | Date:{" "}
                      {new Date().toLocaleDateString()}
                    </p>
                    <Button type="submit" className="w-full">
                      Upload
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
