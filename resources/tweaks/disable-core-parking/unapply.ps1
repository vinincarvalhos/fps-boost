$ErrorActionPreference = 'Stop'
$store = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-core-parking'
$s = Get-ItemProperty $store -ErrorAction SilentlyContinue
$ac = if ($s) { $s.AC } else { 10 }
$dc = if ($s) { $s.DC } else { 10 }
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES $ac
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES $dc
powercfg -setactive SCHEME_CURRENT
if ($s) {
  Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583' -Name Attributes -Value $s.Attributes -Type DWord
}
Remove-Item $store -Force -ErrorAction SilentlyContinue
