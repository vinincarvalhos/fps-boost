netsh interface teredo set state default | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }
