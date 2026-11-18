# FpsBoost — design

A referência visual do app é o [DESIGN.md](../DESIGN.md) na raiz do projeto (estilo inspirado na Apple, instalado com `npx getdesign add apple`). As adaptações feitas para o FpsBoost estão na seção **FpsBoost adaptations** no fim daquele arquivo.

Logo e ícones: `build/icon.svg` (hexágono sólido com duas setas). Para regenerar `build/icon.png` e `build/icon.ico`:

```powershell
npx electron scripts/render-icon.cjs
```
