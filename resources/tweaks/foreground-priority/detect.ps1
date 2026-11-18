# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' -Name 'Win32PrioritySeparation' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Win32PrioritySeparation' -ne '38') { $ok = $false }
if ($ok) { '1' } else { '0' }
