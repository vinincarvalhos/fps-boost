# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\multimedia-gaming-profile'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'SystemResponsiveness' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '10') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'GPU Priority' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '8') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '1' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Priority' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '6') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '2' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Scheduling Category' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq 'High') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '3' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value ([uint32]10) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -Value ([uint32]8) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -Value ([uint32]6) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -Value 'High' -PropertyType String -Force | Out-Null
