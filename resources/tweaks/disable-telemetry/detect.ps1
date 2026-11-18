# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'AllowTelemetry' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Enabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy' -Name 'TailoredExperiencesWithDiagnosticDataEnabled' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'TailoredExperiencesWithDiagnosticDataEnabled' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Siuf\Rules' -Name 'NumberOfSIUFInPeriod' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'NumberOfSIUFInPeriod' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
