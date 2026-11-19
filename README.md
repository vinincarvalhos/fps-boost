# FpsBoost

Otimizador de Windows para jogos. Electron + React + TypeScript; identidade visual "Placa-mãe" (ver [docs/design.md](docs/design.md)).

## Rodar

Os ajustes mexem no registro, em serviços e no plano de energia, então o app precisa de **administrador**. Abra o terminal como administrador e:

```powershell
pnpm install
pnpm dev
```

| Comando | O que faz |
|---|---|
| `pnpm dev` | Abre o app em modo desenvolvimento |
| `pnpm typecheck` | Verifica os tipos |
| `pnpm test` | Testes (metadados e scripts dos ajustes) |
| `pnpm dist` | Gera o instalador NSIS em `dist/` (pede admin ao instalar) |

## Ajustes

Cada ajuste é uma pasta em `resources/tweaks/<id>/`:

- `meta.json` — `title`, `description`, `details` (markdown), `confirm` (texto do aviso), `risk` (`safe`/`caution`), `reversible`, `recommended`, `restart`, `category`, `hardware`, `backupKeys`
- `apply.ps1`, `unapply.ps1`
- `detect.ps1` (opcional) — imprime `1` se o ajuste está ativo; o app mostra o estado real do Windows

Ajustes que só mudam valores do registro são gerados por `node scripts/gen-registry-tweaks.mjs`: edite a lista lá e rode de novo. Eles guardam os valores originais em `HKLM:\SOFTWARE\FpsBoost\Stash\<id>` e os devolvem ao reverter.

## Licença Premium

Chaves no formato `FPSB-XXXXX-XXXXX-XXXXX-XXXXX`, ativadas na tela **Licença**. O servidor fica em [server/](server/README.md) (Vercel + Upstash). Sem licença, o app libera o painel, os ajustes seguros e o backup; ajustes avançados e "Otimizar agora" pedem Premium (conferido também no processo principal).

## Publicar uma atualização

O app procura novas versões nos Releases de [vinincarvalhos/fps-boost](https://github.com/vinincarvalhos/fps-boost) ao abrir e a cada hora; a versão encontrada fica guardada e aparece na barra superior assim que o app abre. O repositório precisa ser **público** para o app baixar sem senha.

1. Aumente `version` em `package.json` (ex.: 0.1.0 → 0.2.0).
2. Crie um token do GitHub (Settings → Developer settings → Fine-grained token, permissão *Contents: read and write* no repositório).
3. Gere e publique:

```powershell
$env:GH_TOKEN = "SEU_TOKEN"; pnpm release
```

Isso cria um rascunho de release com o instalador e o `latest.yml`; abra o release no GitHub e clique em **Publish**. Quem tem o app instalado vê "Versão 0.2.0 disponível" no topo.

## Limpeza e aplicativos

- **Limpeza**: a análise é gratuita; limpar arquivos, RAM e registro pede Premium. A limpeza nunca segue atalhos/junções, nunca usa como raiz uma pasta do sistema ou pessoal e pula arquivos em uso. As entradas de registro removidas são copiadas para Backup antes.
- **Apps do Windows**: catálogo em `resources/appx-catalog.json` (presets Básico, Recomendado e Extremo). A Store, o winget, o Terminal, a Segurança do Windows e os codecs nunca são listados (`PROTECTED` em `src/main/services/appx.ts`).
- **Programas**: o desinstalador do próprio programa roda; depois o app procura sobras com nome exatamente igual. Pastas vão para a Lixeira.
- **Instalar**: lista em `resources/winget-catalog.json`.

## Jogos e Modo jogo

- **Biblioteca**: detecta Steam (todas as bibliotecas), Epic, GOG e Ubisoft Connect; outros jogos entram por "Adicionar jogo". Capas vêm do CDN da Steam (para jogos de outras lojas, o nome é buscado na Steam só para achar a capa).
- **Ajustes por jogo** (grátis): prioridade alta de CPU (Image File Execution Options), GPU dedicada (UserGpuPreferences) e sem otimizações de tela cheia (AppCompatFlags) para o `.exe` do jogo.
- **Modo jogo** (Premium): ao detectar um processo dentro da pasta de um jogo da Biblioteca, troca o plano de energia, fixa o timer em 0,5 ms, pausa serviços, libera RAM dos outros programas (só se ela estiver quase cheia) e põe o jogo em prioridade acima do normal. A detecção usa um único processo do PowerShell que fica aberto, em vez de abrir um novo a cada verificação. Tudo é desfeito quando o jogo fecha, quando o app sai e, se o app cair, na próxima abertura.

## Placa de vídeo, dispositivos, drivers e utilitários

- **Placa de vídeo**: métricas em tempo real via `nvidia-smi`. O otimizador da NVIDIA (Premium) baixa sob demanda o [NVIDIA Profile Inspector](https://github.com/Orbmu2k/nvidiaProfileInspector) v3.0.2.1 (licença MIT), confere o SHA-256 da versão oficial e importa um `.nip` no perfil global com `-silentImport -mergeImport`, então só as configurações marcadas mudam. Antes da primeira mudança, `-exportCustomized` guarda o perfil global; "Restaurar o anterior" o reimporta com `-replaceImport`. IDs e valores vêm do `NvApiDriverSettings.h` da NVIDIA.
- **Dispositivos**: modo MSI (só liga; só desliga onde o próprio app ligou; nunca desliga em controladores de disco), suspensão seletiva do USB, velocidade do mouse e repetição do teclado.
- **Drivers**: inventário com a idade de cada driver e instalação de atualizações pelo Windows Update; o driver de vídeo aponta para o instalador oficial do fabricante.
- **Utilitários**: teste de velocidade de DNS e troca para o mais rápido (ou volta ao automático), TRIM/desfragmentação, limpar o cache de DNS, redefinir a rede e reiniciar o Explorador.

## BIOS

Diagnóstico **só de leitura**: o FpsBoost nunca grava na BIOS. Pelo Windows, ele verifica o perfil de memória (XMP/EXPO, comparando a velocidade atual com a do código do módulo), o Resizable BAR (tamanho do BAR1 no `nvidia-smi`), o Secure Boot, o TPM 2.0, o modo UEFI, a virtualização e a idade da BIOS. Para cada item, explica onde fica a opção (os nomes mudam entre AMD e Intel), abre a página de suporte do fabricante e reinicia direto na BIOS (`shutdown /r /fw`). Em notebooks e PCs de marca, o nome mostrado é o do computador (ex.: Acer Nitro AN515-46), não o código da placa.

## Etapas

1. **Núcleo** (pronto): painel, ajustes, backup, configurações
2. **Licença e atualização automática** (pronto)
3. **Limpeza e aplicativos** (pronto): limpeza de arquivos, RAM e registro; remoção de apps do Windows, desinstalador com sobras e instalação via winget
4. **Jogos e Modo jogo** (pronto): biblioteca com capas, ajustes por jogo e perfil de desempenho automático
5. **Placa de vídeo, dispositivos, drivers e utilitários** (pronto)
6. **BIOS** (pronto): diagnóstico só de leitura e reinício direto na BIOS
