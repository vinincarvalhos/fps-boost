# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' -Name 'GlobalTimerResolutionRequests' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GlobalTimerResolutionRequests' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
