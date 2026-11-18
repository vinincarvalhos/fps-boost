# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI' -Name 'DisableAIDataAnalysis' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'DisableAIDataAnalysis' -ne '1') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Software\Policies\Microsoft\Windows\WindowsAI' -Name 'DisableAIDataAnalysis' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'DisableAIDataAnalysis' -ne '1') { $ok = $false }
if ($ok) { '1' } else { '0' }
