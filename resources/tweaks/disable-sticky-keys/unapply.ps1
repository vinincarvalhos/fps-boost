# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-sticky-keys'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
$prev = if ($saved) { $saved.'0' } else { '__absent__' }
if ($prev -eq '__absent__') {
  # sem valor original: volta ao padrão do Windows
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -Value '510' -PropertyType String -Force | Out-Null
} else {
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -Value $prev -PropertyType String -Force | Out-Null
}
$prev = if ($saved) { $saved.'1' } else { '__absent__' }
if ($prev -eq '__absent__') {
  # sem valor original: volta ao padrão do Windows
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Name 'Flags' -Value '62' -PropertyType String -Force | Out-Null
} else {
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Name 'Flags' -Value $prev -PropertyType String -Force | Out-Null
}
$prev = if ($saved) { $saved.'2' } else { '__absent__' }
if ($prev -eq '__absent__') {
  # sem valor original: volta ao padrão do Windows
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -Value '126' -PropertyType String -Force | Out-Null
} else {
  New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -Value $prev -PropertyType String -Force | Out-Null
}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
