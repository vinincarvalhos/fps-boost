# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\verbose-status'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'VerboseStatus' -ErrorAction SilentlyContinue
} else {
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'VerboseStatus' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
