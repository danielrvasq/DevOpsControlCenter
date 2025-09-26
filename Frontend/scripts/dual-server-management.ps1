# Script de PowerShell para gestión de dos servidores separados
# Servidor de Aplicaciones: 192.168.1.100
# Servidor de Repositorios: 192.168.1.101

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("applications", "repositories")]
    [string]$ServerType,
    
    [Parameter(Mandatory=$true)]
    [string]$Action,
    
    [string]$ServiceName = "",
    [string]$ProjectName = "",
    [string]$Path = "",
    [string]$Command = ""
)

# Configuración de servidores
$ApplicationServer = @{
    Host = "192.168.1.100"
    Port = 3000
    Protocol = "http"
}

$RepositoryServer = @{
    Host = "192.168.1.101"
    Port = 22
    Username = "git"
    BasePath = "/repositories"
}

function Manage-ApplicationServer {
    param($Action, $ServiceName, $Path, $Command)
    
    $serverHost = $ApplicationServer.Host
    
    switch ($Action) {
        "start-service" {
            try {
                # Ejecutar comando remoto en servidor de aplicaciones
                Invoke-Command -ComputerName $serverHost -ScriptBlock {
                    param($ServiceName, $Path, $Command)
                    
                    Set-Location $Path
                    if ($Command -like "*pm2*") {
                        pm2 start $Command --name $ServiceName
                    } else {
                        # IIS Application
                        Start-WebApplication -Site "Default Web Site" -Name $ServiceName
                    }
                } -ArgumentList $ServiceName, $Path, $Command
                
                Write-Output "Servicio $ServiceName iniciado en $serverHost"
                return $true
            } catch {
                Write-Error "Error al iniciar servicio en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
        "stop-service" {
            try {
                Invoke-Command -ComputerName $serverHost -ScriptBlock {
                    param($ServiceName, $Command)
                    
                    if ($Command -like "*pm2*") {
                        pm2 stop $ServiceName
                    } else {
                        Stop-WebApplication -Site "Default Web Site" -Name $ServiceName
                    }
                } -ArgumentList $ServiceName, $Command
                
                Write-Output "Servicio $ServiceName detenido en $serverHost"
                return $true
            } catch {
                Write-Error "Error al detener servicio en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
        "restart-all" {
            try {
                Invoke-Command -ComputerName $serverHost -ScriptBlock {
                    # Reiniciar IIS
                    iisreset /restart
                    
                    # Reiniciar todos los procesos PM2
                    pm2 restart all
                }
                
                Write-Output "Todos los servicios reiniciados en $serverHost"
                return $true
            } catch {
                Write-Error "Error al reiniciar servicios en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
    }
}

function Manage-RepositoryServer {
    param($Action, $ProjectName)
    
    $serverHost = $RepositoryServer.Host
    $username = $RepositoryServer.Username
    $basePath = $RepositoryServer.BasePath
    
    switch ($Action) {
        "create-repository" {
            try {
                $repoPath = "$basePath/$($ProjectName.ToLower().Replace(' ', '-')).git"
                
                # Crear repositorio bare en servidor remoto
                $sshCommand = "ssh $username@$serverHost `"git init --bare $repoPath`""
                Invoke-Expression $sshCommand
                
                Write-Output "Repositorio $ProjectName creado en $serverHost`:$repoPath"
                return $true
            } catch {
                Write-Error "Error al crear repositorio en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
        "backup-repositories" {
            try {
                $backupScript = @"
                    cd $basePath
                    tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz *.git
                    echo 'Backup de repositorios completado'
"@
                
                $sshCommand = "ssh $username@$serverHost `"$backupScript`""
                $result = Invoke-Expression $sshCommand
                
                Write-Output $result
                return $true
            } catch {
                Write-Error "Error al crear backup en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
        "sync-repositories" {
            try {
                $syncScript = @"
                    cd $basePath
                    for dir in *.git; do
                        if [ -d "\$dir" ]; then
                            cd "\$dir"
                            git gc --aggressive
                            cd ..
                        fi
                    done
                    echo 'Sincronización de repositorios completada'
"@
                
                $sshCommand = "ssh $username@$serverHost `"$syncScript`""
                $result = Invoke-Expression $sshCommand
                
                Write-Output $result
                return $true
            } catch {
                Write-Error "Error al sincronizar repositorios en $serverHost`: $($_.Exception.Message)"
                return $false
            }
        }
    }
}

try {
    $success = $false
    
    switch ($ServerType) {
        "applications" {
            $success = Manage-ApplicationServer -Action $Action -ServiceName $ServiceName -Path $Path -Command $Command
        }
        "repositories" {
            $success = Manage-RepositoryServer -Action $Action -ProjectName $ProjectName
        }
    }
    
    if ($success) {
        Write-Output "Operación '$Action' completada exitosamente en servidor $ServerType"
        exit 0
    } else {
        Write-Error "Error al ejecutar operación '$Action' en servidor $ServerType"
        exit 1
    }
} catch {
    Write-Error "Error general: $($_.Exception.Message)"
    exit 1
}
