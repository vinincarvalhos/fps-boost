import os from 'node:os'
import type { MemoryInfo, MemoryResult } from '@shared/types'
import { runPsJson } from './powershell'

// Trims every process's working set (EmptyWorkingSet) and purges the standby list
// (NtSetSystemInformation / MemoryPurgeStandbyList). Pages go back to RAM on demand,
// so nothing is lost; programs just reload what they actually use.
const CSHARP = `
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class FpsMem {
  [DllImport("psapi.dll")] static extern bool EmptyWorkingSet(IntPtr h);
  [DllImport("ntdll.dll")] static extern uint NtSetSystemInformation(int cls, ref int info, int len);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr h, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool LookupPrivilegeValue(string sys, string name, out long luid);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr token, bool disableAll, ref TokPriv state, int len, IntPtr prev, IntPtr retLen);
  [StructLayout(LayoutKind.Sequential, Pack = 1)] struct TokPriv { public int Count; public long Luid; public int Attr; }
  static void Enable(string name) {
    IntPtr token;
    if (!OpenProcessToken(Process.GetCurrentProcess().Handle, 0x28, out token)) return;
    TokPriv tp; tp.Count = 1; tp.Attr = 2;
    if (LookupPrivilegeValue(null, name, out tp.Luid)) AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
  }
  // skipDir: processes under this folder (the running game) keep their memory
  public static int TrimAll(string skipDir) {
    Enable("SeIncreaseQuotaPrivilege");
    int n = 0;
    foreach (var p in Process.GetProcesses()) {
      try {
        if (!String.IsNullOrEmpty(skipDir)) {
          string path = null;
          try { path = p.MainModule.FileName; } catch { }
          if (path != null && path.StartsWith(skipDir, StringComparison.OrdinalIgnoreCase)) continue;
        }
        if (EmptyWorkingSet(p.Handle)) n++;
      } catch { }
    }
    return n;
  }
  public static bool PurgeStandby() {
    Enable("SeProfileSingleProcessPrivilege");
    int cmd = 4; // MemoryPurgeStandbyList
    return NtSetSystemInformation(80, ref cmd, 4) == 0; // SystemMemoryListInformation
  }
}`

const FREE_MB = '[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)'

/** Total and available RAM, read by Node (no PowerShell; the Cleaning page polls this). */
export async function memoryInfo(): Promise<MemoryInfo> {
  return { totalMb: Math.round(os.totalmem() / 1024 ** 2), availableMb: Math.round(os.freemem() / 1024 ** 2) }
}

export interface FreeMemoryOptions {
  /** Install folder of a running game: its processes are not trimmed. */
  skipDir?: string
  /** Also drop the standby list (file cache). Off while gaming: the game would re-read its assets from disk. */
  purgeStandby?: boolean
}

export async function freeMemory(opts: FreeMemoryOptions = {}): Promise<MemoryResult> {
  const skip = (opts.skipDir ?? '').replace(/'/g, "''")
  const purge = opts.purgeStandby ?? true
  const script = `
Add-Type -TypeDefinition @'
${CSHARP}
'@
$before = ${FREE_MB}
$trimmed = [FpsMem]::TrimAll('${skip}')
$purged = ${purge ? '[FpsMem]::PurgeStandby()' : '$false'}
Start-Sleep -Milliseconds 400
$after = ${FREE_MB}
[pscustomobject]@{ before = $before; after = $after; trimmed = $trimmed; purged = $purged }`
  const r = await runPsJson<{ before: number; after: number; trimmed: number; purged: boolean }>(script, 60_000)
  if (!r) return { ok: false, beforeMb: 0, afterMb: 0, freedMb: 0, trimmed: 0, standbyPurged: false, error: 'Não foi possível liberar a memória.' }
  return {
    ok: true,
    beforeMb: r.before,
    afterMb: r.after,
    freedMb: Math.max(0, r.after - r.before),
    trimmed: r.trimmed,
    standbyPurged: r.purged
  }
}
