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

## Etapas

1. **Núcleo** (pronto): painel, ajustes, backup, configurações
2. Conta/licença e atualização automática pelo GitHub
3. Limpeza e aplicativos
4. Jogos e modo jogo
5. Placa de vídeo, hardware, drivers e utilitários
6. BIOS
