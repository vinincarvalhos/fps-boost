# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\multimedia-gaming-profile'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
$prev = if ($saved) { $saved.'1' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
$prev = if ($saved) { $saved.'2' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
$prev = if ($saved) { $saved.'3' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -Value $prev -PropertyType String -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
