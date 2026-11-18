# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'AppsUseLightTheme' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AppsUseLightTheme' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'SystemUsesLightTheme' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'SystemUsesLightTheme' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
