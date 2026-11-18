if ((Get-Service DiagTrack -ErrorAction SilentlyContinue).StartType -eq 'Disabled') { '1' } else { '0' }
