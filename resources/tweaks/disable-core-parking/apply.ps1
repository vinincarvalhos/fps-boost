$ErrorActionPreference = 'Stop'
$store = 'HKLM:\SOFTWARE\FpsBoost\Stash\disable-core-parking'
$setting = '0cc5b647-c1df-4637-891a-dec35c318583'
$attrKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\$setting"
$attr = (Get-ItemProperty $attrKey -Name Attributes -ErrorAction SilentlyContinue).Attributes
# powercfg só mostra o valor quando a configuração está visível (Attributes = 2).
Set-ItemProperty $attrKey -Name Attributes -Value 2 -Type DWord
if (-not (Test-Path $store)) {
  # Os dois últimos números hexadecimais da saída são os índices atuais (tomada, bateria),
  # seja qual for o idioma do Windows.
  $hex = [regex]::Matches(((powercfg /q SCHEME_CURRENT SUB_PROCESSOR $setting) -join "`n"), '0x([0-9a-fA-F]{8})')
  $ac = if ($hex.Count -ge 2) { [Convert]::ToInt32($hex[$hex.Count-2].Groups[1].Value, 16) } else { 10 }
  $dc = if ($hex.Count -ge 2) { [Convert]::ToInt32($hex[$hex.Count-1].Groups[1].Value, 16) } else { 10 }
  New-Item -Path $store -Force | Out-Null
  New-ItemProperty $store -Name AC -Value $ac -PropertyType DWord -Force | Out-Null
  New-ItemProperty $store -Name DC -Value $dc -PropertyType DWord -Force | Out-Null
  New-ItemProperty $store -Name Attributes -Value $(if ($null -eq $attr) { 1 } else { $attr }) -PropertyType DWord -Force | Out-Null
}
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100
powercfg -setactive SCHEME_CURRENT
