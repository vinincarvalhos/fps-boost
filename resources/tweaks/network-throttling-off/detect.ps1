# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'NetworkThrottlingIndex' -ne '4294967295') { $ok = $false }
if ($ok) { '1' } else { '0' }
