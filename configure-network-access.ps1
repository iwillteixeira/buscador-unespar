# Execute este script no PowerShell do Windows como ADMINISTRADOR
# Clique com botão direito no PowerShell e escolha "Executar como Administrador"

$wslIP = "172.23.169.66"
$port = 5173

Write-Host "=== Configurando acesso a rede para servidor Vite no WSL ===" -ForegroundColor Green
Write-Host ""

# Remover regras antigas
Write-Host "Removendo configurações antigas..." -ForegroundColor Yellow
netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null

# Adicionar port forwarding
Write-Host "Configurando port forwarding..." -ForegroundColor Yellow
netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIP

# Configurar firewall
Write-Host "Configurando firewall..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "WSL Vite Server" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "WSL Vite Server" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow | Out-Null

Write-Host ""
Write-Host "=== Configuração concluída! ===" -ForegroundColor Green
Write-Host ""
Write-Host "WSL IP: $wslIP"
Write-Host "Porta: $port"
Write-Host ""
Write-Host "IPs do Windows para acessar de outros computadores:" -ForegroundColor Cyan
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown"} | Select-Object IPAddress, InterfaceAlias | Format-Table

Write-Host ""
Write-Host "Outros computadores devem acessar: http://[IP-DO-WINDOWS]:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Para verificar as regras de port forwarding:" -ForegroundColor Yellow
Write-Host "  netsh interface portproxy show all"
