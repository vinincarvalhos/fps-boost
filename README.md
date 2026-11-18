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

O app procura novas versões nos Releases de [vinincarvalhos/fps-boost](https://github.com/vinincarvalhos/fps-boost) ao abrir e a cada 6 horas. O repositório precisa ser **público** para o app baixar sem senha.

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

## Etapas

1. **Núcleo** (pronto): painel, ajustes, backup, configurações
2. **Licença e atualização automática** (pronto)
3. **Limpeza e aplicativos** (pronto): limpeza de arquivos, RAM e registro; remoção de apps do Windows, desinstalador com sobras e instalação via winget
4. Jogos e modo jogo
5. Placa de vídeo, hardware, drivers e utilitários
6. BIOS
