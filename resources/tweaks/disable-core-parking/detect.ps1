$hex = [regex]::Matches(((powercfg /q SCHEME_CURRENT SUB_PROCESSOR 0cc5b647-c1df-4637-891a-dec35c318583) -join "`n"), '0x([0-9a-fA-F]{8})')
if ($hex.Count -ge 2 -and [Convert]::ToInt32($hex[$hex.Count-2].Groups[1].Value, 16) -eq 100) { '1' } else { '0' }
