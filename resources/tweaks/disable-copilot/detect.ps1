# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'TurnOffWindowsCopilot' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'TurnOffWindowsCopilot' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowCopilotButton' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'ShowCopilotButton' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
