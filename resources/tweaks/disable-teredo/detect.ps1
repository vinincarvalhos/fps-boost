$type = (Get-NetTeredoConfiguration -ErrorAction SilentlyContinue).Type
if ("$type" -eq 'Disabled') { '1' } else { '0' }
