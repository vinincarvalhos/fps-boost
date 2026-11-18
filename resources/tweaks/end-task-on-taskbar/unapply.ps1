# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\end-task-on-taskbar'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings' -Name 'TaskbarEndTask' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings' -Name 'TaskbarEndTask' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
