# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'HwSchMode' -ne '2') { $ok = $false }
if ($ok) { '1' } else { '0' }
