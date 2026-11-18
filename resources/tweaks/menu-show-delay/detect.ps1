# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'MenuShowDelay' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'MenuShowDelay' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
