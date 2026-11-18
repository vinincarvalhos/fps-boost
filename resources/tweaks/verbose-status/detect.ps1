# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'VerboseStatus' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'VerboseStatus' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
