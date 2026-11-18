$s = Get-ItemProperty -Path 'HKLM:\SOFTWARE\FpsBoost\Stash\ultimate-performance-plan' -ErrorAction SilentlyContinue
$active = (powercfg /getactivescheme) -join ' '
if ($s.Created -and $active -match $s.Created) { '1' } else { '0' }
