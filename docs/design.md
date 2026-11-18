# FpsBoost — direção visual "Placa-mãe"

**Assunto**: otimizador de Windows para quem joga. **Público**: jogadores de PC, 15–35 anos, que querem mais FPS sem quebrar o sistema. **Função principal**: aplicar e reverter ajustes com segurança, vendo o efeito no próprio hardware.

A interface é a placa de circuito do PC do usuário: máscara de solda verde, serigrafia branca, contatos e trilhas de ouro.

## Cor
| Token | Hex | Uso |
|---|---|---|
| `mask-deep` | `#082A21` | Barra lateral, fundo mais profundo |
| `mask` | `#0E3B2F` | Superfície principal |
| `mask-raised` | `#16503F` | Componentes (CIs), linhas em hover |
| `silk` | `#EDEFE6` | Texto principal (serigrafia) |
| `silk-dim` | `#9FB8AB` | Texto secundário |
| `gold` | `#C9A44A` | Trilhas, pads, estado ligado |
| `gold-hot` | `#F0D27A` | Trilha com carga alta |
| `flux` | `#E5594F` | Risco "atenção", erros |

Nada de preto puro nem cinza azulado; o "escuro" aqui é sempre verde.

## Tipografia
Uma família: **Archivo** (variável, eixos `wght` e `wdth`). A largura é o recurso expressivo:
- Títulos: `wdth 125`, `wght 800`, entrelinha apertada, caixa normal (sem caixa-alta).
- Corpo: `wdth 100`, `wght 400`, 15px/1.5, linhas ≤ 72 caracteres.
- Números ao vivo: `wdth 62` (condensado), `font-variant-numeric: tabular-nums`.
- Designadores de componente (U1, J2, SW1) só no esquema do painel, onde identificam peças — como numa placa real.

## Layout
```
┌──────┬──────────────────────────────────────────┐
│ borda│  Título largo                             │
│ de   │                                           │
│ conec│  [ conteúdo alinhado à esquerda ]         │
│ tor  │                                           │
│ (nav)│                                           │
└──────┴──────────────────────────────────────────┘
```
- Navegação = borda de conector: cada item tem um "dedo" dourado que fica sólido quando ativo.
- Conteúdo alinhado à esquerda, largura máxima ~1100px.
- Raio 3px em CIs/painéis, pads circulares; hierarquia por largura de fonte e espessura de trilha, não por sombras.

## Princípios
1. **O destaque é o esquema do painel**: CPU, GPU, RAM e disco reais desenhados como CIs, ligados por trilhas que brilham conforme a carga. Todo o resto fica quieto.
2. **Ajustes são DIP switches**: alavanca retangular que desliza e trava com o contato dourado — o movimento mostra o que mudou.
3. **Sem decoração gratuita**: sem gradientes, sem sombras suaves genéricas, sem animação de entrada em cada seção.
4. **Texto direto**: verbos claros ("Aplicar", "Reverter", "Criar ponto de restauração"); erros dizem o que houve e como resolver.
5. Foco visível de teclado (contorno dourado), `prefers-reduced-motion` respeitado.
