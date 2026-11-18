# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\windowed-game-optimizations'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -Name 'DirectXUserGlobalSettings' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -Name 'DirectXUserGlobalSettings' -Value $prev -PropertyType String -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
