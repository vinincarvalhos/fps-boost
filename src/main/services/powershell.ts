import { spawn } from 'node:child_process'
import log from 'electron-log/main'

export interface PsResult {
  code: number
  stdout: string
  stderr: string
}

const BASE_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass']

function run(args: string[], timeoutMs: number): Promise<PsResult> {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [...BASE_ARGS, ...args], { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      stderr += `\nTempo esgotado após ${timeoutMs / 1000}s`
      child.kill()
    }, timeoutMs)
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: String(err) })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() })
    })
  })
}

/** Runs an inline PowerShell command. UTF-8 output so accents survive. */
export async function runPs(command: string, timeoutMs = 60_000): Promise<PsResult> {
  const wrapped = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; ${command}`
  const res = await run(['-Command', wrapped], timeoutMs)
  if (res.code !== 0) log.warn('[ps] comando falhou', { command: command.slice(0, 200), stderr: res.stderr })
  return res
}

/** Runs a .ps1 file. */
export async function runPsFile(file: string, timeoutMs = 120_000): Promise<PsResult> {
  const res = await run(['-File', file], timeoutMs)
  log.info('[ps] script', file, 'código', res.code)
  if (res.stderr) log.warn('[ps] stderr', res.stderr)
  return res
}

/** Runs a command that prints JSON (ConvertTo-Json) and parses it. */
export async function runPsJson<T>(command: string, timeoutMs?: number): Promise<T | null> {
  const res = await runPs(`${command} | ConvertTo-Json -Depth 4 -Compress`, timeoutMs)
  if (res.code !== 0 || !res.stdout) return null
  try {
    return JSON.parse(res.stdout) as T
  } catch {
    return null
  }
}
