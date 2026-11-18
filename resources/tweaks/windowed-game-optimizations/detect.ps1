# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -Name 'DirectXUserGlobalSettings' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'DirectXUserGlobalSettings' -ne 'SwapEffectUpgradeEnable=1;') { $ok = $false }
if ($ok) { '1' } else { '0' }
