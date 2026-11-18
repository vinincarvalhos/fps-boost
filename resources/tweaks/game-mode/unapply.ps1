# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\game-mode'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
$prev = if ($saved) { $saved.'1' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AllowAutoGameMode' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AllowAutoGameMode' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
