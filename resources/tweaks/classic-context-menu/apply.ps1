$key = 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32'
New-Item -Path $key -Force | Out-Null
Set-Item -Path $key -Value ''
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
