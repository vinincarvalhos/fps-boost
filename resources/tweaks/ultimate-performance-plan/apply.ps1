$ErrorActionPreference = 'Stop'
$store = 'HKLM:\SOFTWARE\FpsBoost\Stash\ultimate-performance-plan'
$active = [regex]::Match(((powercfg /getactivescheme) -join ' '), '[0-9a-fA-F-]{36}').Value
if (-not (Test-Path $store)) {
  New-Item -Path $store -Force | Out-Null
  New-ItemProperty -Path $store -Name Previous -Value $active -PropertyType String -Force | Out-Null
}
$old = (Get-ItemProperty -Path $store -ErrorAction SilentlyContinue).Created
if ($old) { powercfg -delete $old 2>$null | Out-Null }
$out = (powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61) -join ' '
$guid = [regex]::Match($out, '[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}').Value
if (-not $guid) { throw 'Este Windows não oferece o plano Desempenho Máximo.' }
powercfg -changename $guid 'FpsBoost Desempenho Máximo' | Out-Null
New-ItemProperty -Path $store -Name Created -Value $guid -PropertyType String -Force | Out-Null
powercfg -setactive $guid
