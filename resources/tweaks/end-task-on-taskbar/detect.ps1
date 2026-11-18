# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings' -Name 'TaskbarEndTask' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'TaskbarEndTask' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
