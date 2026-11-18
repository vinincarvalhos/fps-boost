# FpsBoost — direção visual (painel SaaS azul-marinho)

Direção definida pelo usuário a partir de uma referência de dashboard SaaS: fundo azul-marinho profundo com brilho azul/violeta, cards arredondados translúcidos, item ativo em pílula azul com brilho, barra superior com busca, cards de métrica com tendência e gráfico de área, gráfico grande de linhas e gráfico de rosca.

## Logo
`build/icon.svg` (componente `LogoMark` em `src/renderer/src/components/Logo.tsx`): hexágono arredondado em degradê `#38BDF8 → #3B82F6 → #8B5CF6` com duas setas brancas subindo ("boost"); a de baixo a 55% de opacidade. Ao lado, o nome "FpsBoost" em Plus Jakarta Sans 700.

Para regenerar `build/icon.png` (512 px) e `build/icon.ico` (256 px) depois de mudar o SVG:
```powershell
npx electron scripts/render-icon.cjs
```

## Cor
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#0A0F24` | Fundo, com brilhos radiais azul (topo direito) e violeta (base esquerda) |
| `bg-2` | `#0E1530` | Barra lateral |
| `card` / `card-2` | `#131B3A` / `#18224A` | Cards (degradê vertical entre os dois) |
| `line` | `#222D58` | Bordas e divisórias |
| `ink` / `muted` | `#E8ECF8` / `#8A94B8` | Texto principal / secundário |
| `primary` → `violet` | `#3B82F6` → `#8B5CF6` | Botão principal, item ativo, chaves ligadas (degradê) |
| `cpu` `gpu` `ram` `disk` | `#3B82F6` `#A855F7` `#F59E0B` `#22D3EE` | Cor fixa de cada recurso em gráficos e etiquetas |
| `up` / `danger` | `#22C55E` / `#EF4444` | Tendência boa, sucesso / risco, erro |

## Tipografia
- **Plus Jakarta Sans** (variável): títulos, nomes de card e números grandes, com algarismos tabulares.
- **Inter** (variável): texto de interface, 14px.

## Componentes
- `.card`: raio 14px, borda `line`, degradê `card-2 → card`, brilho interno no topo e sombra profunda.
- `.btn-primary`: degradê azul→índigo com brilho azul; `.btn-ghost` para ações secundárias.
- `Toggle`: trilho em degradê azul→violeta quando ligado.
- `Sparkline`, `AreaChart` e `Donut` em `components/Sparkline.tsx`: área com degradê da cor do recurso até transparente.

## Layout
- Barra lateral de 252px: logo, grupos (Sistema, Otimizar, Jogos, Hardware, Segurança); seções futuras com um ponto cinza ("em breve").
- Barra superior: busca de ajustes (vai para Ajustes com `?q=`), selo de administrador, avatar com as iniciais e botões da janela.
- Painel: 4 KPIs → gráfico em tempo real + rosca de ajustes ativos → atividade recente, recomendados e hardware.
