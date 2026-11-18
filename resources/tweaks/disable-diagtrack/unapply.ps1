$ErrorActionPreference = 'Stop'
Set-Service DiagTrack -StartupType Automatic
Start-Service DiagTrack -ErrorAction SilentlyContinue
