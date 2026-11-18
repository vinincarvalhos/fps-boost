import type { RestorePoint } from '@shared/types'
import { runPs, runPsJson } from './powershell'

const SR_KEY = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\SystemRestore'

export async function listRestorePoints(): Promise<RestorePoint[]> {
  const raw = await runPsJson<
    { SequenceNumber: number; Description: string; CreationTime: string } | { SequenceNumber: number; Description: string; CreationTime: string }[]
  >('Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, CreationTime')
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .map((r) => ({
      sequence: r.SequenceNumber,
      description: r.Description,
      // CreationTime is WMI format yyyymmddHHMMSS.ffffff+zzz
      createdAt: wmiToIso(r.CreationTime)
    }))
    .sort((a, b) => b.sequence - a.sequence)
}

function wmiToIso(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : s
}

/**
 * Creates a restore point. Windows only allows one every 24h by default, so the
 * frequency limit is lifted for this call and put back afterwards.
 */
export async function createRestorePoint(description: string): Promise<{ ok: boolean; error?: string }> {
  const safe = description.replace(/'/g, "''").slice(0, 60)
  const res = await runPs(
    `$prev = (Get-ItemProperty -Path '${SR_KEY}' -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue).SystemRestorePointCreationFrequency
     Set-ItemProperty -Path '${SR_KEY}' -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord
     try {
       Enable-ComputerRestore -Drive "$env:SystemDrive\\"
       Checkpoint-Computer -Description '${safe}' -RestorePointType MODIFY_SETTINGS
     } finally {
       if ($null -eq $prev) { Remove-ItemProperty -Path '${SR_KEY}' -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue }
       else { Set-ItemProperty -Path '${SR_KEY}' -Name SystemRestorePointCreationFrequency -Value $prev -Type DWord }
     }`,
    180_000
  )
  return res.code === 0 ? { ok: true } : { ok: false, error: res.stderr || 'Falha ao criar o ponto de restauração' }
}

/** Starts a system restore to the given point. Windows reboots on its own. */
export async function restoreTo(sequence: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(sequence)) return { ok: false, error: 'Ponto inválido' }
  const res = await runPs(`Restore-Computer -RestorePoint ${sequence} -Confirm:$false`, 120_000)
  return res.code === 0 ? { ok: true } : { ok: false, error: res.stderr }
}

export async function deleteAllRestorePoints(): Promise<{ ok: boolean; error?: string }> {
  const res = await runPs('vssadmin delete shadows /for=$env:SystemDrive /all /quiet | Out-Null')
  return res.code === 0 ? { ok: true } : { ok: false, error: res.stderr }
}
