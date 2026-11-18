# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'RotatingLockScreenOverlayEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'RotatingLockScreenOverlayEnabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338387Enabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'SubscribedContent-338387Enabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'SubscribedContent-338388Enabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SilentInstalledAppsEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'SilentInstalledAppsEnabled' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
