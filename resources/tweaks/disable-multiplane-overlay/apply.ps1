# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-multiplane-overlay'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
  $p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'OverlayTestMode' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '5') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '0' -Value $prev -PropertyType String -Force | Out-Null
}
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm')) { New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -Value ([uint32]5) -PropertyType DWord -Force | Out-Null
