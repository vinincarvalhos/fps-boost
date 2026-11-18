$ErrorActionPreference = 'Stop'
if ((Get-MMAgent).MemoryCompression) { '0' } else { '1' }
