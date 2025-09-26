# Script de PowerShell para gestión de servicios IIS y PM2
# Este script debe ejecutarse con permisos de administrador

param(
    [Parameter(Mandatory=$true)]
    [string]$Action,
    
    [Parameter(Mandatory=$true)]
    [string]$ServiceType,
    
    [Parameter(Mandatory=$true)]
    [string]$ServiceName,
    
    [string]$Path = "",
    [string]$Command = "",
    [int]$Port = 0
)

function Manage-IISApplication {
    param($Action, $SiteName, $AppName)
    
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    
    switch ($Action) {
        "start" {
            Start-WebApplication -Site $SiteName -Name $AppName
            Write-Output "IIS Application $AppName started successfully"
        }
        "stop" {
            Stop-WebApplication -Site $SiteName -Name $AppName
            Write-Output "IIS Application $AppName stopped successfully"
        }
        "restart" {
            Stop-WebApplication -Site $SiteName -Name $AppName
            Start-Sleep -Seconds 2
            Start-WebApplication -Site $SiteName -Name $AppName
            Write-Output "IIS Application $AppName restarted successfully"
        }
    }
}

function Manage-PM2Service {
    param($Action, $ServiceName, $Path, $Command)
    
    switch ($Action) {
        "start" {
            if ($Path -and $Command) {
                Set-Location $Path
                pm2 start $Command --name $ServiceName
            } else {
                pm2 start $ServiceName
            }
            Write-Output "PM2 service $ServiceName started successfully"
        }
        "stop" {
            pm2 stop $ServiceName
            Write-Output "PM2 service $ServiceName stopped successfully"
        }
        "restart" {
            pm2 restart $ServiceName
            Write-Output "PM2 service $ServiceName restarted successfully"
        }
    }
}

try {
    switch ($ServiceType.ToLower()) {
        "iis" {
            $parts = $ServiceName -split "/"
            $siteName = $parts[0]
            $appName = if ($parts.Length -gt 1) { $parts[1] } else { "" }
            Manage-IISApplication -Action $Action -SiteName $siteName -AppName $appName
        }
        "pm2" {
            Manage-PM2Service -Action $Action -ServiceName $ServiceName -Path $Path -Command $Command
        }
        default {
            Write-Error "Tipo de servicio no soportado: $ServiceType"
            exit 1
        }
    }
    
    Write-Output "Operation completed successfully"
    exit 0
} catch {
    Write-Error "Error executing operation: $($_.Exception.Message)"
    exit 1
}
