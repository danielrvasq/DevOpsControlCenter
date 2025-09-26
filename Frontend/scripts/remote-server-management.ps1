# Script de PowerShell para gestión de servidores remotos
# Maneja tanto el servidor de aplicaciones como el de repositorios

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerType,  # "applications" o "repositories"
    
    [Parameter(Mandatory=$true)]
    [string]$Action,      # "check", "restart", "backup", "sync"
    
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [string]$Username = "",
    [string]$KeyPath = "",
    [int]$Port = 22
)

function Manage-ApplicationServer {
    param($Action, $ServerIP)
    
    switch ($Action) {
        "check" {
            # Verificar conectividad con servidor de aplicaciones
            $result = Test-NetConnection -ComputerName $ServerIP -Port 3000
            if ($result.TcpTestSucceeded) {
                Write-Output "Servidor de aplicaciones accesible en $ServerIP"
                return $true
            } else {
                Write-Error "No se puede conectar al servidor de aplicaciones"
                return $false
            }
        }
        "restart" {
            # Reiniciar servicios en servidor remoto via WinRM
            try {
                Invoke-Command -ComputerName $ServerIP -ScriptBlock {
                    # Reiniciar IIS
                    iisreset /restart
                    
                    # Reiniciar servicios PM2
                    pm2 restart all
                    
                    Write-Output "Servicios reiniciados correctamente"
                }
                return $true
            } catch {
                Write-Error "Error al reiniciar servicios: $($_.Exception.Message)"
                return $false
            }
        }
    }
}

function Manage-RepositoryServer {
    param($Action, $ServerIP, $Username, $KeyPath)
    
    switch ($Action) {
        "check" {
            # Verificar conectividad SSH con servidor de repositorios
            try {
                $sshTest = ssh -i $KeyPath -o ConnectTimeout=10 "$Username@$ServerIP" "echo 'SSH connection successful'"
                if ($sshTest -eq "SSH connection successful") {
                    Write-Output "Servidor de repositorios accesible via SSH"
                    return $true
                } else {
                    Write-Error "Error en conexión SSH"
                    return $false
                }
            } catch {
                Write-Error "No se puede conectar via SSH: $($_.Exception.Message)"
                return $false
            }
        }
        "backup" {
            # Crear backup de repositorios
            try {
                $backupScript = @"
                    cd /repositories
                    tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz *
                    echo 'Backup creado correctamente'
"@
                $result = ssh -i $KeyPath "$Username@$ServerIP" $backupScript
                Write-Output $result
                return $true
            } catch {
                Write-Error "Error al crear backup: $($_.Exception.Message)"
                return $false
            }
        }
        "sync" {
            # Sincronizar repositorios
            try {
                $syncScript = @"
                    cd /repositories
                    for dir in */; do
                        if [ -d "\$dir/.git" ]; then
                            cd "\$dir"
                            git fetch --all
                            git gc --aggressive
                            cd ..
                        fi
                    done
                    echo 'Sincronización completada'
"@
                $result = ssh -i $KeyPath "$Username@$ServerIP" $syncScript
                Write-Output $result
                return $true
            } catch {
                Write-Error "Error al sincronizar: $($_.Exception.Message)"
                return $false
            }
        }
    }
}

try {
    $success = $false
    
    switch ($ServerType.ToLower()) {
        "applications" {
            $success = Manage-ApplicationServer -Action $Action -ServerIP $ServerIP
        }
        "repositories" {
            $success = Manage-RepositoryServer -Action $Action -ServerIP $ServerIP -Username $Username -KeyPath $KeyPath
        }
        default {
            Write-Error "Tipo de servidor no soportado: $ServerType"
            exit 1
        }
    }
    
    if ($success) {
        Write-Output "Operación '$Action' completada exitosamente en servidor $ServerType"
        exit 0
    } else {
        Write-Error "Error al ejecutar operación '$Action'"
        exit 1
    }
} catch {
    Write-Error "Error general: $($_.Exception.Message)"
    exit 1
}
