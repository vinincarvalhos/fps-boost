# Servidor de licenças do FpsBoost

Funções serverless da Vercel com banco Redis da Upstash. O servidor guarda as chaves e assina licenças com Ed25519; o app confere a assinatura com a chave pública embutida em `src/main/services/license-key.ts`, então funciona offline por até 7 dias.

## Rotas

| Rota | Corpo | Uso |
|---|---|---|
| `POST /api/activate` | `{ key, machineId, machineName }` | O app ativa a chave neste PC |
| `POST /api/validate` | `{ key, machineId }` | O app revalida (ao abrir e a cada 12 h) |
| `POST /api/deactivate` | `{ key, machineId }` | Libera a vaga do PC |
| `POST /api/admin/keys` | `{ count, maxMachines, expiresInDays, note }` | Gera chaves |
| `POST /api/admin/status` | `{ key, status: "active" \| "revoked" }` | Revoga ou reativa uma chave |
| `POST /api/admin/info` | `{ key }` | Mostra a chave e os PCs em que está ativa |

As rotas `admin` exigem o cabeçalho `Authorization: Bearer <ADMIN_SECRET>`. As públicas têm limite de tentativas por IP.

## Publicar na Vercel

1. **Chaves**: `server/.env.local` já foi gerado com `LICENSE_PRIVATE_KEY` e `ADMIN_SECRET`, e a chave pública correspondente já está no app. **Nunca** coloque a chave privada no git nem no app. Se gerar um par novo (`node scripts/gen-keys.js`), atualize também `LICENSE_PUBLIC_KEY` no app; licenças antigas deixam de valer.
2. **Projeto**: na Vercel, importe o repositório `vinincarvalhos/fps-boost` e defina **Root Directory = `server`**.
3. **Banco**: em *Storage*, crie um banco **Upstash Redis** (plano grátis) e conecte ao projeto. Isso cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` / `_TOKEN`), que o servidor já reconhece.
4. **Variáveis**: em *Settings → Environment Variables*, adicione `LICENSE_PRIVATE_KEY` e `ADMIN_SECRET` com os valores de `server/.env.local`.
5. **Deploy**. Se a URL final não for `https://fps-boost-server.vercel.app`, crie `.env` na raiz do app com `MAIN_VITE_LICENSE_API=<sua URL>` antes de gerar o instalador.

## Gerar chaves

```powershell
$admin = 'COLE_O_ADMIN_SECRET'
Invoke-RestMethod -Method Post -Uri https://fps-boost-server.vercel.app/api/admin/keys -Headers @{ Authorization = "Bearer $admin" } -ContentType 'application/json' -Body '{"count":5,"maxMachines":2,"note":"lote de teste"}'
```

`expiresInDays` é opcional (sem ele, a chave não vence).

## Testar localmente

```powershell
node server/dev.js
```

Sobe em `http://127.0.0.1:3005` com dados em memória (somem ao fechar). Para o app usar esse servidor:

```powershell
$env:MAIN_VITE_LICENSE_API = 'http://127.0.0.1:3005'; pnpm dev
```
