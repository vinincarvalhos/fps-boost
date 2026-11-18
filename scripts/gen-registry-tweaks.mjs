// Generates resources/tweaks/<id>/ for tweaks that only set registry values.
// Each generated tweak saves the user's previous values in HKLM:\SOFTWARE\FpsBoost\Stash\<id>
// on first apply and puts them back on unapply; detect.ps1 prints 1 when every value matches.
//
// Usage: node scripts/gen-registry-tweaks.mjs   (overwrites only the ids listed here)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(import.meta.dirname, '..', 'resources', 'tweaks')

/** default: Windows' own value, used when reverting a tweak whose value was already set before FpsBoost */
/** @typedef {{ path: string, name: string, type: 'DWord'|'String', value: string|number, default?: string|number }} Val */
/** @type {{ id: string, meta: object, values: Val[] }[]} */
const TWEAKS = [
  {
    id: 'game-mode',
    meta: {
      title: 'Ligar o Modo de Jogo do Windows',
      description: 'Dá prioridade de CPU e GPU ao jogo aberto e segura atualizações automáticas enquanto você joga.',
      category: ['Jogos'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', type: 'DWord', value: 1 },
      { path: 'HKCU:\\Software\\Microsoft\\GameBar', name: 'AllowAutoGameMode', type: 'DWord', value: 1 }
    ]
  },
  {
    id: 'disable-game-dvr',
    meta: {
      title: 'Desligar gravação em segundo plano (Game DVR)',
      description: 'Impede o Windows de gravar os últimos minutos de jogo o tempo todo, o que consome GPU e disco.',
      details:
        'Desliga a captura contínua do Xbox Game Bar. A Game Bar continua abrindo com **Win+G**; só a gravação automática para.',
      category: ['Jogos'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\System\\GameConfigStore', name: 'GameDVR_Enabled', type: 'DWord', value: 0 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', name: 'AppCaptureEnabled', type: 'DWord', value: 0 },
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR', name: 'AllowGameDVR', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'disable-fullscreen-optimizations',
    meta: {
      title: 'Tela cheia exclusiva de verdade',
      description: 'Desliga as "otimizações de tela cheia", que rodam jogos em janela sem borda disfarçada.',
      details:
        'Em alguns jogos isso reduz a latência de entrada. Em outros, o alt+tab fica mais lento. Se notar piora, desligue.',
      category: ['Jogos'],
      risk: 'caution',
      confirm: 'Alguns jogos ficam com alt+tab mais lento em tela cheia exclusiva. Você pode reverter a qualquer momento.'
    },
    values: [
      { path: 'HKCU:\\System\\GameConfigStore', name: 'GameDVR_FSEBehaviorMode', type: 'DWord', value: 2 },
      { path: 'HKCU:\\System\\GameConfigStore', name: 'GameDVR_HonorUserFSEBehaviorMode', type: 'DWord', value: 1 },
      { path: 'HKCU:\\System\\GameConfigStore', name: 'GameDVR_DXGIHonorFSEWindowsCompatible', type: 'DWord', value: 1 }
    ]
  },
  {
    id: 'enable-hags',
    meta: {
      title: 'Agendamento de GPU acelerado por hardware',
      description: 'Deixa a própria placa de vídeo gerenciar sua fila de trabalho, o que pode reduzir a latência.',
      details: 'Exige GPU NVIDIA GTX 10 / AMD RX 5000 ou mais nova, com driver atual. **Precisa reiniciar.**',
      category: ['Jogos'],
      hardware: 'gpu',
      restart: true,
      recommended: true
    },
    values: [{ path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', name: 'HwSchMode', type: 'DWord', value: 2 }]
  },
  {
    id: 'windowed-game-optimizations',
    meta: {
      title: 'Otimizar jogos em janela',
      description: 'Usa o modelo de apresentação moderno em jogos DirectX 10/11 em janela, com menos latência e suporte a VRR.',
      category: ['Jogos'],
      hardware: 'gpu',
      recommended: true
    },
    values: [
      {
        path: 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences',
        name: 'DirectXUserGlobalSettings',
        type: 'String',
        value: 'SwapEffectUpgradeEnable=1;'
      }
    ]
  },
  {
    id: 'disable-multiplane-overlay',
    meta: {
      title: 'Desligar Multiplane Overlay (MPO)',
      description: 'Resolve tela piscando e travadas em alguns PCs com mais de um monitor ou drivers NVIDIA.',
      details: 'Só ligue se você tem cintilação, tela preta rápida ou stutter no navegador/jogo. **Precisa reiniciar.**',
      category: ['Jogos'],
      hardware: 'gpu',
      restart: true
    },
    values: [{ path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Dwm', name: 'OverlayTestMode', type: 'DWord', value: 5 }]
  },
  {
    id: 'global-timer-resolution',
    meta: {
      title: 'Resolução de timer global',
      description: 'Quando um programa pede um timer mais preciso, o sistema inteiro passa a usá-lo, como no Windows antigo.',
      details: 'Disponível no Windows 11. Alguns jogos e programas de áudio dependem desse comportamento. **Precisa reiniciar.**',
      category: ['Desempenho'],
      hardware: 'cpu',
      restart: true
    },
    values: [
      {
        path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel',
        name: 'GlobalTimerResolutionRequests',
        type: 'DWord',
        value: 1
      }
    ]
  },
  {
    id: 'foreground-priority',
    meta: {
      title: 'Prioridade para a janela em foco',
      description: 'Dá fatias de tempo de CPU mais curtas e favorece o programa que está na frente, como o jogo.',
      details: 'Define `Win32PrioritySeparation` como `0x26` (fatias curtas, variáveis, com bônus para o primeiro plano).',
      category: ['Desempenho'],
      hardware: 'cpu',
      recommended: true
    },
    values: [
      { path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl', name: 'Win32PrioritySeparation', type: 'DWord', value: 38 }
    ]
  },
  {
    id: 'multimedia-gaming-profile',
    meta: {
      title: 'Perfil multimídia para jogos',
      description: 'Reserva menos CPU para tarefas de fundo e dá prioridade alta de GPU e agendamento para jogos.',
      category: ['Desempenho'],
      recommended: true
    },
    values: [
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
        name: 'SystemResponsiveness',
        type: 'DWord',
        value: 10
      },
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
        name: 'GPU Priority',
        type: 'DWord',
        value: 8
      },
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
        name: 'Priority',
        type: 'DWord',
        value: 6
      },
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games',
        name: 'Scheduling Category',
        type: 'String',
        value: 'High'
      }
    ]
  },
  {
    id: 'disable-power-throttling',
    meta: {
      title: 'Desligar o Power Throttling',
      description: 'Impede o Windows de reduzir a CPU de programas em segundo plano, como Discord e OBS durante o jogo.',
      details: 'Em notebooks, a bateria dura menos.',
      category: ['Desempenho'],
      hardware: 'cpu'
    },
    values: [
      {
        path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling',
        name: 'PowerThrottlingOff',
        type: 'DWord',
        value: 1
      }
    ]
  },
  {
    id: 'disable-mouse-acceleration',
    meta: {
      title: 'Mira sem aceleração do mouse',
      description: 'Desliga "Aumentar precisão do ponteiro", para o mesmo movimento da mão sempre virar a mesma distância na tela.',
      details: 'Vale a partir do próximo login.',
      category: ['Jogos'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseSpeed', type: 'String', value: '0', default: '1' },
      { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseThreshold1', type: 'String', value: '0', default: '6' },
      { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseThreshold2', type: 'String', value: '0', default: '10' }
    ]
  },
  {
    id: 'disable-sticky-keys',
    meta: {
      title: 'Parar o aviso de Teclas de Aderência',
      description: 'Apertar Shift cinco vezes no meio do jogo deixa de abrir a janela de Teclas de Aderência.',
      category: ['Jogos'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\Control Panel\\Accessibility\\StickyKeys', name: 'Flags', type: 'String', value: '506', default: '510' },
      { path: 'HKCU:\\Control Panel\\Accessibility\\ToggleKeys', name: 'Flags', type: 'String', value: '58', default: '62' },
      { path: 'HKCU:\\Control Panel\\Accessibility\\Keyboard Response', name: 'Flags', type: 'String', value: '122', default: '126' }
    ]
  },
  {
    id: 'network-throttling-off',
    meta: {
      title: 'Desligar limite de rede para multimídia',
      description: 'Remove o limite que o Windows impõe ao tráfego de rede enquanto toca áudio ou vídeo.',
      category: ['Rede']
    },
    values: [
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile',
        name: 'NetworkThrottlingIndex',
        type: 'DWord',
        value: 4294967295
      }
    ]
  },
  {
    id: 'prefer-ipv4',
    meta: {
      title: 'Preferir IPv4 ao IPv6',
      description: 'Usa IPv4 primeiro quando os dois estão disponíveis. Ajuda quando o IPv6 do provedor tem rota pior.',
      details: 'O IPv6 continua ligado; muda só a ordem de preferência. **Precisa reiniciar.**',
      category: ['Rede'],
      restart: true
    },
    values: [
      {
        path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters',
        name: 'DisabledComponents',
        type: 'DWord',
        value: 32
      }
    ]
  },
  {
    id: 'disable-telemetry',
    meta: {
      title: 'Reduzir telemetria',
      description: 'Envia à Microsoft só os dados de diagnóstico obrigatórios e desliga anúncios personalizados.',
      category: ['Privacidade'],
      recommended: true
    },
    values: [
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', name: 'AllowTelemetry', type: 'DWord', value: 0 },
      {
        path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo',
        name: 'Enabled',
        type: 'DWord',
        value: 0
      },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', name: 'TailoredExperiencesWithDiagnosticDataEnabled', type: 'DWord', value: 0 },
      { path: 'HKCU:\\Software\\Microsoft\\Siuf\\Rules', name: 'NumberOfSIUFInPeriod', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'disable-activity-history',
    meta: {
      title: 'Desligar histórico de atividades',
      description: 'O Windows deixa de registrar quais programas e arquivos você abre.',
      category: ['Privacidade']
    },
    values: [
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', name: 'EnableActivityFeed', type: 'DWord', value: 0 },
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', name: 'PublishUserActivities', type: 'DWord', value: 0 },
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', name: 'UploadUserActivities', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'disable-copilot',
    meta: {
      title: 'Desligar o Copilot',
      description: 'Remove o botão e o atalho do Copilot da barra de tarefas.',
      category: ['Privacidade']
    },
    values: [
      { path: 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot', name: 'TurnOffWindowsCopilot', type: 'DWord', value: 1 },
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot', name: 'TurnOffWindowsCopilot', type: 'DWord', value: 1 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'ShowCopilotButton', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'disable-recall',
    meta: {
      title: 'Desligar o Recall',
      description: 'Impede o Windows de tirar capturas de tela periódicas para a busca do Recall.',
      category: ['Privacidade']
    },
    values: [
      { path: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI', name: 'DisableAIDataAnalysis', type: 'DWord', value: 1 },
      { path: 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsAI', name: 'DisableAIDataAnalysis', type: 'DWord', value: 1 }
    ]
  },
  {
    id: 'disable-bing-search',
    meta: {
      title: 'Busca do Iniciar sem Bing',
      description: 'A busca do menu Iniciar mostra só arquivos e apps do seu PC, sem resultados da web.',
      details: 'Fica mais rápida e não envia o que você digita para a internet. Vale depois de reiniciar o Explorer.',
      category: ['Privacidade'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer', name: 'DisableSearchBoxSuggestions', type: 'DWord', value: 1 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', name: 'BingSearchEnabled', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'disable-location',
    meta: {
      title: 'Desligar localização',
      description: 'Apps e o Windows deixam de acessar sua localização.',
      category: ['Privacidade']
    },
    values: [
      {
        path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location',
        name: 'Value',
        type: 'String',
        value: 'Deny', default: 'Allow'
      }
    ]
  },
  {
    id: 'disable-lockscreen-tips',
    meta: {
      title: 'Tela de bloqueio sem dicas e anúncios',
      description: 'Remove dicas, curiosidades e sugestões de apps da tela de bloqueio e do Iniciar.',
      category: ['Privacidade']
    },
    values: [
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'RotatingLockScreenOverlayEnabled', type: 'DWord', value: 0 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SubscribedContent-338387Enabled', type: 'DWord', value: 0 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SubscribedContent-338388Enabled', type: 'DWord', value: 0 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SilentInstalledAppsEnabled', type: 'DWord', value: 0 }
    ]
  },
  {
    id: 'menu-show-delay',
    meta: {
      title: 'Menus abrem sem atraso',
      description: 'Submenus aparecem na hora, sem a espera padrão de 400 ms.',
      category: ['Interface']
    },
    values: [{ path: 'HKCU:\\Control Panel\\Desktop', name: 'MenuShowDelay', type: 'String', value: '0', default: '400' }]
  },
  {
    id: 'show-file-extensions',
    meta: {
      title: 'Mostrar extensões de arquivo',
      description: 'O Explorador mostra .exe, .zip, .png… no nome dos arquivos, o que ajuda a evitar arquivos disfarçados.',
      category: ['Interface'],
      recommended: true
    },
    values: [
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'HideFileExt', type: 'DWord', value: 0, default: 1 }
    ]
  },
  {
    id: 'show-hidden-files',
    meta: {
      title: 'Mostrar arquivos ocultos',
      description: 'O Explorador passa a listar arquivos e pastas ocultos, como AppData.',
      category: ['Interface']
    },
    values: [{ path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'Hidden', type: 'DWord', value: 1, default: 2 }]
  },
  {
    id: 'end-task-on-taskbar',
    meta: {
      title: '"Finalizar tarefa" na barra de tarefas',
      description: 'Clique com o botão direito num app travado na barra de tarefas e feche-o sem abrir o Gerenciador.',
      category: ['Interface'],
      recommended: true
    },
    values: [
      {
        path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced\\TaskbarDeveloperSettings',
        name: 'TaskbarEndTask',
        type: 'DWord',
        value: 1
      }
    ]
  },
  {
    id: 'dark-mode',
    meta: {
      title: 'Modo escuro',
      description: 'Deixa o Windows e os apps com tema escuro.',
      category: ['Interface']
    },
    values: [
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'AppsUseLightTheme', type: 'DWord', value: 0, default: 1 },
      { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'SystemUsesLightTheme', type: 'DWord', value: 0, default: 1 }
    ]
  },
  {
    id: 'taskbar-align-left',
    meta: {
      title: 'Barra de tarefas à esquerda',
      description: 'Move o botão Iniciar e os ícones para a esquerda, como no Windows 10.',
      category: ['Interface']
    },
    values: [{ path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'TaskbarAl', type: 'DWord', value: 0, default: 1 }]
  },
  {
    id: 'verbose-status',
    meta: {
      title: 'Mostrar o que o Windows está fazendo ao ligar',
      description: 'Na inicialização e no desligamento aparece o passo atual, em vez de só "Aguarde".',
      category: ['Sistema']
    },
    values: [
      { path: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System', name: 'VerboseStatus', type: 'DWord', value: 1 }
    ]
  },
  {
    id: 'detailed-bsod',
    meta: {
      title: 'Tela azul com detalhes',
      description: 'Quando o Windows trava com tela azul, mostra o código e o driver responsável em vez do rosto triste.',
      category: ['Sistema']
    },
    values: [
      { path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CrashControl', name: 'DisplayParameters', type: 'DWord', value: 1 }
    ]
  },
  {
    id: 'long-paths',
    meta: {
      title: 'Caminhos de arquivo longos',
      description: 'Permite caminhos com mais de 260 caracteres, comum em mods de jogos e projetos de programação.',
      category: ['Sistema']
    },
    values: [{ path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', name: 'LongPathsEnabled', type: 'DWord', value: 1, default: 0 }]
  }
]

const ps = (s) => s.replace(/'/g, "''")
const lit = (v) => (typeof v === 'number' ? `([uint32]${v})` : `'${ps(v)}'`)

function applyPs(id, values) {
  const stash = `HKLM:\\SOFTWARE\\FpsBoost\\Stash\\${id}`
  const save = values
    .map(
      (v, i) => `  $p = Get-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -ErrorAction SilentlyContinue
  $prev = if ($null -eq $p) { '__absent__' } else { [string]$p.'${ps(v.name)}' }
  # Já estava com o valor do ajuste: reverter deve voltar ao padrão do Windows (valor removido).
  if ($prev -eq '${ps(String(v.value))}') { $prev = '__absent__' }
  New-ItemProperty -Path $stash -Name '${i}' -Value $prev -PropertyType String -Force | Out-Null`
    )
    .join('\n')
  const set = values
    .map(
      (v) => `if (-not (Test-Path '${ps(v.path)}')) { New-Item -Path '${ps(v.path)}' -Force | Out-Null }
New-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -Value ${lit(v.value)} -PropertyType ${v.type} -Force | Out-Null`
    )
    .join('\n')
  return `# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = '${stash}'
# Guarda os valores originais só na primeira aplicação, para não sobrescrevê-los com os do próprio ajuste.
if (-not (Test-Path $stash)) {
  New-Item -Path $stash -Force | Out-Null
${save}
}
${set}
`
}

function unapplyPs(id, values) {
  const stash = `HKLM:\\SOFTWARE\\FpsBoost\\Stash\\${id}`
  const restore = values
    .map(
      (v, i) => `$prev = if ($saved) { $saved.'${i}' } else { '__absent__' }
if ($prev -eq '__absent__') {
  ${
    v.default !== undefined
      ? `# sem valor original: volta ao padrão do Windows
  New-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -Value ${lit(v.default)} -PropertyType ${v.type} -Force | Out-Null`
      : `Remove-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -ErrorAction SilentlyContinue`
  }
} else {
  New-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -Value ${v.type === 'DWord' ? '([uint32][int64]$prev)' : '$prev'} -PropertyType ${v.type} -Force | Out-Null
}`
    )
    .join('\n')
  return `# Gerado por scripts/gen-registry-tweaks.mjs
$ErrorActionPreference = 'Stop'
$stash = '${stash}'
$saved = Get-ItemProperty -Path $stash -ErrorAction SilentlyContinue
${restore}
Remove-Item -Path $stash -Force -ErrorAction SilentlyContinue
`
}

function detectPs(values) {
  const checks = values
    .map(
      (v) => `$p = Get-ItemProperty -Path '${ps(v.path)}' -Name '${ps(v.name)}' -ErrorAction SilentlyContinue
if ($null -eq $p -or [string]$p.'${ps(v.name)}' -ne '${ps(String(v.value))}') { $ok = $false }`
    )
    .join('\n')
  return `# Gerado por scripts/gen-registry-tweaks.mjs
$ok = $true
${checks}
if ($ok) { '1' } else { '0' }
`
}

for (const t of TWEAKS) {
  const dir = join(OUT, t.id)
  mkdirSync(dir, { recursive: true })
  const meta = { risk: 'safe', reversible: true, ...t.meta, backupKeys: [...new Set(t.values.map((v) => v.path))] }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  // UTF-8 with BOM so Windows PowerShell 5.1 reads accented text correctly
  const bom = '﻿'
  writeFileSync(join(dir, 'apply.ps1'), bom + applyPs(t.id, t.values))
  writeFileSync(join(dir, 'unapply.ps1'), bom + unapplyPs(t.id, t.values))
  writeFileSync(join(dir, 'detect.ps1'), bom + detectPs(t.values))
}
console.log(`${TWEAKS.length} ajustes de registro gerados em ${OUT}`)
