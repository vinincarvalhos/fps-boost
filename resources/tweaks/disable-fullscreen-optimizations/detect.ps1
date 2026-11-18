# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_FSEBehaviorMode' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GameDVR_FSEBehaviorMode' -ne '2') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GameDVR_HonorUserFSEBehaviorMode' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_DXGIHonorFSEWindowsCompatible' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GameDVR_DXGIHonorFSEWindowsCompatible' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
