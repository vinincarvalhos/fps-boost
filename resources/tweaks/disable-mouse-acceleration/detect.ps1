# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSpeed' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'MouseSpeed' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold1' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'MouseThreshold1' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold2' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'MouseThreshold2' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
