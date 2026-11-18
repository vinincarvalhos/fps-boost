# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' -Name 'PowerThrottlingOff' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'PowerThrottlingOff' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
