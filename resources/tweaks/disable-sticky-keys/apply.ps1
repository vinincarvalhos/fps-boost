# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-sticky-keys'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Flags' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '506') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Name 'Flags' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Flags' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '58') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '1' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Flags' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '122') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '2' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKCU:\Control Panel\Accessibility\StickyKeys')) { New-Item -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -Value '506' -PropertyType String -Force | Out-Null
if (-not (Test-Path 'HKCU:\Control Panel\Accessibility\ToggleKeys')) { New-Item -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Name 'Flags' -Value '58' -PropertyType String -Force | Out-Null
if (-not (Test-Path 'HKCU:\Control Panel\Accessibility\Keyboard Response')) { New-Item -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -Value '122' -PropertyType String -Force | Out-Null
