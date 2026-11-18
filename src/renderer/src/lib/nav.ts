import {
  Archive,
  Cpu,
  Gamepad2,
  HardDriveDownload,
  LayoutDashboard,
  MemoryStick,
  MonitorCog,
  Package,
  Crown,
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

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sistema',
    items: [
      { path: '/', label: 'Painel', icon: LayoutDashboard, phase: 1, summary: 'Uso do hardware em tempo real e estado dos ajustes.' },
      { path: '/tweaks', label: 'Ajustes', icon: SlidersHorizontal, phase: 1, summary: 'Ajustes do Windows para jogos, com reversão.' }
    ]
  },
  {
    label: 'Otimizar',
    items: [
      { path: '/clean', label: 'Limpeza', icon: Sparkles, phase: 1, summary: 'Arquivos temporários, caches, RAM e registro.' },
      { path: '/apps', label: 'Aplicativos', icon: Package, phase: 1, summary: 'Remova apps nativos do Windows e desinstale programas sem deixar sobras.' },
      { path: '/utilities', label: 'Utilitários', icon: Wrench, phase: 5, summary: 'DNS mais rápido, otimização de disco e atalhos do sistema.' }
    ]
  },
  {
    label: 'Jogos',
    items: [
      { path: '/games', label: 'Biblioteca', icon: Trophy, phase: 4, summary: 'Seus jogos da Steam, Epic e outros num só lugar.' },
      { path: '/gamemode', label: 'Modo jogo', icon: Gamepad2, phase: 4, summary: 'Um perfil de desempenho que liga sozinho quando o jogo abre.' }
    ]
  },
  {
    label: 'Hardware',
    items: [
      { path: '/gpu-optimizer', label: 'Placa de vídeo', icon: MonitorCog, phase: 5, summary: 'Configurações de driver NVIDIA e AMD para menos latência.' },
      { path: '/hardware', label: 'Dispositivos', icon: Cpu, phase: 5, summary: 'Interrupções em modo MSI, USB e periféricos.' },
      { path: '/drivers', label: 'Drivers', icon: HardDriveDownload, phase: 5, summary: 'Verifica e baixa drivers atualizados.' },
      { path: '/bios', label: 'BIOS', icon: MemoryStick, phase: 6, summary: 'Reiniciar direto na configuração da placa-mãe.' }
    ]
  },
  {
    label: 'Conta e segurança',
    items: [
      { path: '/license', label: 'Licença', icon: Crown, phase: 1, summary: 'Ative sua chave Premium.' },
      { path: '/backup', label: 'Backup', icon: Archive, phase: 1, summary: 'Pontos de restauração e cópias do registro.' },
      { path: '/settings', label: 'Configurações', icon: Settings2, phase: 1, summary: 'Inicialização, bandeja e registros.' }
    ]
  }
]

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
