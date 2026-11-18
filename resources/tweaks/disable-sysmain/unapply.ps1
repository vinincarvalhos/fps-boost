$ErrorActionPreference = 'Stop'
Set-Service SysMain -StartupType Automatic
Start-Service SysMain -ErrorAction SilentlyContinue
