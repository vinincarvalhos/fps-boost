# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'TaskbarAl' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'TaskbarAl' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
