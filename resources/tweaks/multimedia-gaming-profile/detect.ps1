# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'SystemResponsiveness' -ne '10') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'GPU Priority' -ne '8') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Priority' -ne '6') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Scheduling Category' -ne 'High') { $ok = $false }
if ($ok) { '1' } else { '0' }
