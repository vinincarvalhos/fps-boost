# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Flags' -ne '506') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\ToggleKeys' -Name 'Flags' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Flags' -ne '58') { $ok = $false }
$p = Get-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'Flags' -ne '122') { $ok = $false }
if ($ok) { '1' } else { '0' }
