<#
  Testa os ajustes de verdade no Windows (rode como administrador).

  Para cada ajuste com detect.ps1:
    - se já estava ativo: aplica de novo e confere que continua ativo (não reverte, para manter seu estado);
    - se estava desligado: aplica, confere que ficou ativo, reverte e confere que voltou a desligado.

  Uso:  powershell -ExecutionPolicy Bypass -File scripts\test-tweaks.ps1 [-Out resultado.json] [-Only id1,id2] [-IncludeDisruptive]
  -IncludeDisruptive inclui ajustes que reiniciam o Explorador (a barra de tarefas pisca).
#>
param(
  [string]$Out = "$PSScriptRoot\..\tweak-test-results.json",
  [string[]]$Only = @(),
  [switch]$IncludeDisruptive,
  [switch]$NoRestorePoint
)

$ErrorActionPreference = 'Continue'
$root = Join-Path $PSScriptRoot '..\resources\tweaks'
$disruptive = @('classic-context-menu')

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Error 'Rode este script como administrador.'; exit 1 }

function Invoke-Script($file) {
  $out = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $file 2>&1
  [pscustomobject]@{ Code = $LASTEXITCODE; Text = (($out | ForEach-Object { "$_" }) -join "`n").Trim() }
}
function Get-State($dir) {
  $r = Invoke-Script (Join-Path $dir 'detect.ps1')
  if ($r.Code -ne 0) { return "erro: $($r.Text)" }
  return ($r.Text -split "`r?`n")[-1]
}

if (-not $NoRestorePoint) {
  Write-Host 'Criando ponto de restauração de segurança...'
  $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
  Set-ItemProperty $key -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord
  try {
    Enable-ComputerRestore -Drive "$env:SystemDrive\"
    Checkpoint-Computer -Description 'FpsBoost - antes do teste dos ajustes' -RestorePointType MODIFY_SETTINGS
  } catch { Write-Warning "Ponto de restauração não criado: $_" }
  finally { Remove-ItemProperty $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue }
}

$results = foreach ($dir in Get-ChildItem $root -Directory) {
  $id = $dir.Name
  if ($Only.Count -and $Only -notcontains $id) { continue }
  if (-not (Test-Path (Join-Path $dir.FullName 'detect.ps1'))) { continue }
  if (-not $IncludeDisruptive -and $disruptive -contains $id) {
    [pscustomobject]@{ id = $id; result = 'pulado'; detail = 'reinicia o Explorador (use -IncludeDisruptive)' }
    continue
  }
  $meta = Get-Content (Join-Path $dir.FullName 'meta.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  Write-Host "-> $id"
  $before = Get-State $dir.FullName

  $apply = Invoke-Script (Join-Path $dir.FullName 'apply.ps1')
  if ($apply.Code -ne 0) {
    [pscustomobject]@{ id = $id; result = 'FALHOU'; detail = "apply código $($apply.Code): $($apply.Text)" }
    continue
  }
  $mid = Get-State $dir.FullName
  if ($mid -ne '1') {
    $why = if ($meta.restart) { 'detect ainda 0 (ajuste pede reinício; pode ser esperado)' } else { "detect depois do apply = $mid" }
    $res = if ($meta.restart) { 'reinício' } else { 'FALHOU' }
    # reverte para não deixar meio aplicado
    if ($before -ne '1' -and $meta.reversible) { Invoke-Script (Join-Path $dir.FullName 'unapply.ps1') | Out-Null }
    [pscustomobject]@{ id = $id; result = $res; detail = $why }
    continue
  }
  if ($before -eq '1') {
    [pscustomobject]@{ id = $id; result = 'ok'; detail = 'já estava ativo; aplicado de novo, sem reverter' }
    continue
  }
  if (-not $meta.reversible) {
    [pscustomobject]@{ id = $id; result = 'ok'; detail = 'aplicado (sem reversão automática)' }
    continue
  }
  $un = Invoke-Script (Join-Path $dir.FullName 'unapply.ps1')
  if ($un.Code -ne 0) {
    [pscustomobject]@{ id = $id; result = 'FALHOU'; detail = "unapply código $($un.Code): $($un.Text)" }
    continue
  }
  $after = Get-State $dir.FullName
  if ($after -eq $before) { [pscustomobject]@{ id = $id; result = 'ok'; detail = 'aplicou e reverteu' } }
  else { [pscustomobject]@{ id = $id; result = 'FALHOU'; detail = "estado antes=$before, depois de reverter=$after" } }
}

$results | ConvertTo-Json -Depth 3 | Set-Content -Path $Out -Encoding UTF8
$results | Format-Table -AutoSize | Out-String -Width 220 | Write-Host
Write-Host "Resultado salvo em $Out"
