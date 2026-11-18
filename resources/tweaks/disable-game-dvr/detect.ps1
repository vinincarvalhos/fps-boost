# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GameDVR_Enabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AppCaptureEnabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' -Name 'AllowGameDVR' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AllowGameDVR' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
