# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-mouse-acceleration'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSpeed' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'MouseSpeed' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold1' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'MouseThreshold1' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '1' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold2' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'MouseThreshold2' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '2' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKCU:\Control Panel\Mouse')) { New-Item -Path 'HKCU:\Control Panel\Mouse' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSpeed' -Value '0' -PropertyType String -Force | Out-Null
if (-not (Test-Path 'HKCU:\Control Panel\Mouse')) { New-Item -Path 'HKCU:\Control Panel\Mouse' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold1' -Value '0' -PropertyType String -Force | Out-Null
if (-not (Test-Path 'HKCU:\Control Panel\Mouse')) { New-Item -Path 'HKCU:\Control Panel\Mouse' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold2' -Value '0' -PropertyType String -Force | Out-Null
