"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Shield,
  Eye,
  Edit,
  Trash2,
  UserCheck,
} from "lucide-react";

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  rol: "admin" | "developer" | "viewer";
  state: boolean;
  lastAccess: string | null;
}

interface UsersModuleProps {
  currentUser: User | null;
}

export default function UsersModule({ currentUser }: UsersModuleProps) {
  // ESTADOS Y VARIABLES
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    email: "",
    rol: "viewer",
    password: "",
  });

  // EDITAR USUARIO
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    username: "",
    password: "",
    rol: "viewer",
  });

  // PERMISOS
  const canAdmin = currentUser?.rol === "admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  // CARGAR USUARIOS
  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };


  // CREAR USUARIO
  const handleCreateUser = async () => {
    if (
      !newUser.name ||
      !newUser.username ||
      !newUser.email ||
      !newUser.password
    ) {
      alert("Por favor, rellene todos los campos.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) throw new Error("Failed to create user");

      fetchUsers();
      setNewUser({
        name: "",
        username: "",
        email: "",
        rol: "viewer",// si no escoge rol se crea como viewer
        password: "",
      });
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Error al crear el usuario.");
    }
  };
  // ACTUALIZAR USUARIO
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      if (!response.ok) throw new Error("Error actualizando usuario");

      await fetchUsers();
      setEditingUser(null); 
    } catch (err) {
      console.error("Error actualizando usuario:", err);
      alert("No se pudo actualizar el usuario.");
    }
  };

  // ELIMINAR USUARIO
  const handleDeleteUser = async (id: number) => {
    if (!confirm("¿Seguro que quieres eliminar este usuario?")) return;

    try {
      const res = await fetch(`http://localhost:3001/api/users/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error eliminando usuario");

      fetchUsers();
    } catch (err) {
      console.error("Error eliminando usuario:", err);
      alert("No se pudo eliminar el usuario.");
    }
  };

  // MUESTRA EL BADGE SEGUN EL ROL
  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case "admin":
        return <Badge className="bg-red-100 text-red-800">Admin</Badge>;
      case "developer":
        return <Badge className="bg-blue-100 text-blue-800">Developer</Badge>;
      case "viewer":
        return <Badge className="bg-gray-100 text-gray-800">Viewer</Badge>;
      default:
        return <Badge variant="outline">{rol}</Badge>;
    }
  };

  //MUESTRA EL BADGE SEGUN EL ESTADO
  const getStatusBadge = (state: boolean) => {
    return state ? (
      <Badge className="bg-green-100 text-green-800">Activo</Badge>
    ) : (
      <Badge variant="secondary">Inactivo</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-gray-600">
            Administra usuarios, roles y permisos del sistema
          </p>
        </div>
        {canAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nuevo Usuario</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo usuario al sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre Completo</Label>
                  <Input
                    placeholder="Ej: Juan Pérez"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Usuario</Label>
                  <Input
                    placeholder="jperez"
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, username: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="juan.perez@empresa.com"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select
                    value={newUser.rol}
                    onValueChange={(value) =>
                      setNewUser((p) => ({ ...p, rol: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, password: e.target.value }))
                    }
                  />
                </div>
                <Button onClick={handleCreateUser} className="w-full">
                  Crear Usuario
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
          <CardDescription>
            Lista de todos los usuarios registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                {canAdmin && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.rol)}</TableCell>
                  <TableCell>{getStatusBadge(user.state)}</TableCell>
                  <TableCell className="text-sm">
                    {user.lastAccess
                      ? new Date(user.lastAccess).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Nunca"}
                  </TableCell>
                  {canAdmin && (
                    <TableCell>
                      <div className="flex space-x-2">
                        {/* 🔹 Botón editar */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setEditForm({
                              name: user.name,
                              username: user.username,
                              password: "",
                              rol: user.rol,
                            });
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={user.id === currentUser?.id}
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 🔹 Modal de edición */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Usuario</Label>
              <Input
                value={editForm.username}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, username: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Nueva Contraseña</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={editForm.rol}
                onValueChange={(value) =>
                  setEditForm((p) => ({ ...p, rol: value as any }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdateUser} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800 dark:text-red-300">
                  Admin
                </h3>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Control total del sistema</li>
                <li>• Gestión de usuarios</li>
                <li>• Configuración de servicios</li>
                <li>• Acceso a todos los proyectos</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800 dark:text-blue-300">
                  Developer
                </h3>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Gestión de proyectos</li>
                <li>• Subida de código</li>
                <li>• Control de servicios</li>
                <li>• Monitoreo de aplicaciones</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Eye className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-300">
                  Viewer
                </h3>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Solo lectura</li>
                <li>• Ver estado de servicios</li>
                <li>• Consultar proyectos</li>
                <li>• Acceso limitado</li>
              </ul>
            </div>
          </div> 
        </CardContent> 
      </Dialog>
    </div>
  );
}
