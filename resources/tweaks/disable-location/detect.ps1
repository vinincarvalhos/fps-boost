# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Name 'Value' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Value' -ne 'Deny') { $ok = $false }
if ($ok) { '1' } else { '0' }
