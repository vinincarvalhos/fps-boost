# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-copilot'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'TurnOffWindowsCopilot' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '1') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'TurnOffWindowsCopilot' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '1') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '1' -Value $prev -PropertyType String -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowCopilotButton' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'ShowCopilotButton' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '0') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '2' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot')) { New-Item -Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value ([uint32]1) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot')) { New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value ([uint32]1) -PropertyType DWord -Force | Out-Null
if (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced')) { New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Force | Out-Null }
New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowCopilotButton' -Value ([uint32]0) -PropertyType DWord -Force | Out-Null
