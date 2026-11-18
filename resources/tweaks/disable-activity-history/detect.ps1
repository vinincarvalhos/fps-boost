# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'EnableActivityFeed' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'EnableActivityFeed' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'PublishUserActivities' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'PublishUserActivities' -ne '0') { $ok = $false }
$p = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'UploadUserActivities' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'UploadUserActivities' -ne '0') { $ok = $false }
if ($ok) { '1' } else { '0' }
