$ErrorActionPreference = 'Stop'
$store = 'HKLM:\SOFTWARE\FpsBoost\Stash\ultimate-performance-plan'
$s = Get-ItemProperty -Path $store -ErrorAction SilentlyContinue
$prev = if ($s.Previous) { $s.Previous } else { '381b4222-f694-41f0-9685-ff5bb260df2e' }
powercfg -setactive $prev
if ($s.Created) { powercfg -delete $s.Created 2>$null | Out-Null }
Remove-Item -Path $store -Force -ErrorAction SilentlyContinue
