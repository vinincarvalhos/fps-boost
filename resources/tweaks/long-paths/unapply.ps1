# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\long-paths'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  # sem valor original: volta ao padrão do Windows
  New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
} else {
  New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value ([uint32][int64]$prev) -PropertyType DWord -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
