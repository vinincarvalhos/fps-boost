import {
  Archive,
  Cpu,
  Gamepad2,
  HardDriveDownload,
  LayoutGrid,
  MemoryStick,
  MonitorCog,
  Package,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Wrench,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** delivery phase; > 1 shows a "coming" screen for now */
  phase: number
  summary: string
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Painel', icon: LayoutGrid, phase: 1, summary: 'Seu hardware e o uso em tempo real.' },
  { path: '/tweaks', label: 'Ajustes', icon: SlidersHorizontal, phase: 1, summary: 'Ajustes do Windows para jogos, com reversão.' },
  { path: '/clean', label: 'Limpeza', icon: Sparkles, phase: 3, summary: 'Arquivos temporários, caches, RAM e registro.' },
  { path: '/apps', label: 'Aplicativos', icon: Package, phase: 3, summary: 'Remover apps nativos do Windows e desinstalar programas sem deixar sobras.' },
  { path: '/games', label: 'Jogos', icon: Trophy, phase: 4, summary: 'Seus jogos da Steam, Epic e outros num só lugar.' },
  { path: '/gamemode', label: 'Modo jogo', icon: Gamepad2, phase: 4, summary: 'Um perfil de desempenho que liga sozinho quando o jogo abre.' },
  { path: '/gpu-optimizer', label: 'Placa de vídeo', icon: MonitorCog, phase: 5, summary: 'Configurações de driver NVIDIA e AMD para menos latência.' },
  { path: '/hardware', label: 'Hardware', icon: Cpu, phase: 5, summary: 'Interrupções em modo MSI, USB e periféricos.' },
  { path: '/drivers', label: 'Drivers', icon: HardDriveDownload, phase: 5, summary: 'Verifica e baixa drivers atualizados.' },
  { path: '/utilities', label: 'Utilitários', icon: Wrench, phase: 5, summary: 'DNS mais rápido, otimização de disco e atalhos do sistema.' },
  { path: '/bios', label: 'BIOS', icon: MemoryStick, phase: 6, summary: 'Reiniciar direto na configuração da placa-mãe.' },
  { path: '/backup', label: 'Backup', icon: Archive, phase: 1, summary: 'Pontos de restauração e cópias do registro.' },
  { path: '/settings', label: 'Configurações', icon: Settings2, phase: 1, summary: 'Inicialização, bandeja e registros.' }
]
