# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Policies\Microsoft\Windows\Explorer' -Name 'DisableSearchBoxSuggestions' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'DisableSearchBoxSuggestions' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' -Name 'BingSearchEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'BingSearchEnabled' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
