# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AutoGameModeEnabled' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AllowAutoGameMode' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AllowAutoGameMode' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
