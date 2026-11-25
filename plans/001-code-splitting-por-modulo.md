# 001 — Quebrar o bundle único em chunks por módulo

- **Status**: TODO
- **Commit**: cc104969
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: `vite.config.ts` + `App.tsx` + os pontos de import dos módulos; ~6 arquivos

## Problem

O build publicado é **um único chunk de 5,8 MB (1,49 MB gzip)**. Medido no ar em 24/11/2026:

```
curl --compressed https://so-sinergica.netlify.app/assets/index-BMeCtgRP.js
→ 1.496.240 bytes
```

`apps/web/vite.config.ts` não tem `build.rollupOptions.manualChunks` nem nenhuma configuração de
split. O único `lazy()` do projeto é a vitrine de DEV:

```tsx
// apps/web/src/app/App.tsx:22 — atual
  ? lazy(() =>
```

Consequência: um síndico que só abre o Portal do Cliente baixa, parseia e executa o PCM inteiro,
o Financeiro, o Comercial, o Marketing e o construtor de fluxos do Atendimento antes do primeiro
pixel da tela dele.

Quatro dependências pesadas entram estáticas no chunk principal, cada uma usada por uma única
tela:

```ts
// apps/web/src/lib/pdf/relatorio-pdf.ts:5
import { PDFDocument, type PDFImage, type PDFPage, StandardFonts, rgb } from "pdf-lib";
// apps/web/src/features/atendimento/components/FlowBuilderCanvas.tsx:12
} from "@xyflow/react";
// apps/web/src/features/pcm/infrastructure/extrair-xlsx-limitado.ts:1
import { Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";
// apps/web/src/features/pcm/interfaces/codigos-publicos/QrCodigoGrupo.tsx:2
import QRCode from "qrcode";
```

## Target

1. Cada módulo de topo vira um chunk próprio, carregado sob demanda: PCM, Atendimento, Comercial,
   Financeiro, Marketing, Cockpit, Área do Cliente, Configurações, Guia.
2. `pdf-lib`, `@xyflow/react`, `@zip.js/zip.js` e `qrcode` saem do chunk de entrada.
3. O chunk de entrada fica com: React, React DOM, React Router, TanStack Query, Supabase client,
   o shell (`App`, `HomePage`, contexts) e o `login`.

Meta mensurável: **chunk de entrada ≤ 500 KB gzip** e nenhum chunk de módulo acima de 400 KB gzip.

```ts
// apps/web/vite.config.ts — target
export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [react(), tailwindcss()],
  resolve: { /* inalterado */ },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
          "vendor-dados": ["@tanstack/react-query", "@supabase/supabase-js"],
          "vendor-pdf": ["pdf-lib"],
          "vendor-fluxo": ["@xyflow/react"],
          "vendor-arquivo": ["@zip.js/zip.js", "write-excel-file", "@xmldom/xmldom"],
          "vendor-qrcode": ["qrcode"],
        },
      },
    },
  },
});
```

## Repo conventions to follow

- `App.tsx` já importa `Suspense` e `lazy` de `react` (linha 2) — reutilize, não adicione
  dependência.
- O fallback de `Suspense` hoje é `null` (`App.tsx:120`). Para rota de módulo, **não** use `null`:
  use o mesmo `Skeleton` de `@sinergica/ui` que as telas usam, para a troca não ser um branco.
- `Skeleton` vem de `packages/ui/src/Skeleton.tsx` e já respeita `prefers-reduced-motion`.
- Exemplar de import dinâmico correto já no repo: `App.tsx:22-26`.

## Steps

1. Em `apps/web/vite.config.ts`, adicionar o bloco `build.rollupOptions.output.manualChunks`
   exatamente como no Target.
2. Em `apps/web/src/app/App.tsx`, trocar o import estático de cada componente de módulo de topo
   por `lazy(() => import("..."))`, mantendo o import estático de `HomePage`, `LoginPage` e dos
   contexts (são o caminho crítico).
3. Envolver o ponto de render dos módulos num único `<Suspense>` com fallback de `Skeleton`, não
   `null`.
4. Converter `relatorio-pdf.ts` para import dinâmico no ponto de uso: os três chamadores
   (`PortalShell.tsx:7`, `PropostasOsPortal.tsx:6`, `HistoricoPropostaOs.tsx:5`) passam a fazer
   `const { criarRelatorioPdf } = await import("...")` dentro do handler que gera o PDF.
5. Mesma conversão para `QrCodigoGrupo.tsx` (qrcode), `extrair-xlsx-limitado.ts` (zip.js) e
   `FluxosManager.tsx:7` (FlowBuilderCanvas com `lazy()` + `Suspense` local).
6. Rodar o build e conferir o tamanho de cada chunk.

## Boundaries

- NÃO mudar nenhuma lógica de negócio, query, ou RPC.
- NÃO mexer em `index.html` (é o plano 003).
- NÃO adicionar dependência nova.
- NÃO converter para dinâmico nada que esteja no caminho do login ou da HomePage.
- Se algum caminho de import divergir do descrito, PARE e relate em vez de improvisar.

## Verification

- **Mecânica**:
  - `pnpm --filter @sinergica/web build` termina limpo e imprime a lista de chunks.
  - O chunk de entrada (`index-*.js`) fica **abaixo de 500 KB gzip** — conferir na saída do Vite.
  - `pnpm --filter @sinergica/web typecheck` sem erro.
  - `pnpm -w test` verde.
- **Feel check**: abrir o app, logar, e confirmar que (a) a tela de login aparece claramente mais
  rápido, (b) trocar de módulo mostra o Skeleton por um instante e não um branco, (c) gerar um PDF
  no portal continua funcionando (o import dinâmico resolve no clique).
