# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-location'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Name 'Value' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'Value' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq 'Deny') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Name 'Value' -Value 'Deny' -PropertyType String -Force | Out-Null
