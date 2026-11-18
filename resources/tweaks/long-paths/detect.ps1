# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'LongPathsEnabled' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
