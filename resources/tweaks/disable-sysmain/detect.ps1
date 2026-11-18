if ((Get-Service SysMain -ErrorAction SilentlyContinue).StartType -eq 'Disabled') { '1' } else { '0' }
