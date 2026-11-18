# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\enable-hags'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'HwSchMode' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '2') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers')) { New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value ([uint32]2) -PropertyType DWord -Force | Out-Null
