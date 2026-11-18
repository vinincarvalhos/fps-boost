netsh interface teredo set state disabled | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }
