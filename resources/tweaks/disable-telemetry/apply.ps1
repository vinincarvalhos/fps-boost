# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-telemetry'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'AllowTelemetry' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Enabled' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '1' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy' -Name 'TailoredExperiencesWithDiagnosticDataEnabled' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'TailoredExperiencesWithDiagnosticDataEnabled' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '2' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Siuf\Rules' -Name 'NumberOfSIUFInPeriod' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'NumberOfSIUFInPeriod' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '3' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection')) { New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo')) { New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy')) { New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy' -Name 'TailoredExperiencesWithDiagnosticDataEnabled' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKCU:\Software\Microsoft\Siuf\Rules')) { New-Item -Path 'HKCU:\Software\Microsoft\Siuf\Rules' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Software\Microsoft\Siuf\Rules' -Name 'NumberOfSIUFInPeriod' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
