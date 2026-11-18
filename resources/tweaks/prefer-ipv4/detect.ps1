# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters' -Name 'DisabledComponents' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'DisabledComponents' -ne '32') { $ok = $false }
if ($ok) { '1' } else { '0' }
