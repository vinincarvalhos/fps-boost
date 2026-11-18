# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'OverlayTestMode' -ne '5') { $ok = $false }
if ($ok) { '1' } else { '0' }
