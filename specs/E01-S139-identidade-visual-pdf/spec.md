---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Identidade visual nos PDFs de relatório

> **Fonte da verdade.** Origem: Lucas (2026-08-07). "Os relatórios gerados precisam melhorar
> visualmente, os PDFs por exemplo, seria legal ter um logo, cabeçalho para dar um tom de relatório
> profissional." Escopo confirmado via pergunta: os 3 geradores do frontend agora (mesma stack);
> Laudo PMOC (`pmoc-generate-pdf`, Edge Function/Deno) fica para story futura.

## Contexto de código
- 3 páginas geram PDF hoje, cada uma com sua própria cópia de `PDFDocument.create()` +
  `StandardFonts.Helvetica` + loop de `drawText` sem cabeçalho, logo ou rodapé — só texto corrido:
  `RelatorioClientePage.tsx`, `RelatorioDiarioPage.tsx`, `RelatorioPlanejamentoPage.tsx`.
- Nenhum helper compartilhado existe (`apps/web/src/lib` não tem módulo de PDF).
- Assets de marca já existem em `apps/web/public/logos/` (E00-S04):
  `logo-horizontal-branco.png` (para fundo escuro/navy), `logo-horizontal-positivo.png`,
  `logo-simbolo-laranja.png`.
- Paleta de marca em `apps/web/src/index.css`: navy `#1c2748` (estrutura), laranja `#e8731b`
  (destaque/CTA), ink `#1a2138` (texto).

## Resumo
Extrair um helper único de geração de PDF (`apps/web/src/lib/pdf/relatorio-pdf.ts`) que desenha
cabeçalho com faixa navy + logo branco + filete laranja + título/subtítulo, e rodapé com nome da
empresa + "Página X de Y" + data de geração — em toda página, com paginação automática. As 3 páginas
passam a usar esse helper em vez da lógica duplicada de `PDFDocument`/`drawText`.

## Critérios de aceite

### AC-1: Cabeçalho de marca em toda página
- **Dado** qualquer um dos 3 PDFs exportados
- **Quando** o PDF é aberto
- **Então** toda página tem faixa navy no topo com o logo Sinérgica, filete laranja e o
  título/subtítulo do relatório — não só a primeira página.

### AC-2: Rodapé consistente
- **Dado** qualquer um dos 3 PDFs
- **Quando** o PDF é aberto
- **Então** toda página tem rodapé com "Sinérgica Manutenções", "Página X de Y" e data de geração
  (pt-BR).

### AC-3: Paginação automática preservada
- **Dado** um relatório longo (conteúdo que não cabe em 1 página)
- **Quando** o PDF é gerado
- **Então** quebra de página acontece automaticamente, sem cortar texto, com cabeçalho/rodapé
  repetidos em cada página nova (mesmo comportamento que já existia, agora com marca).

### AC-4: Sem duplicação entre os 3 geradores
- **Dado** o código das 3 páginas depois da mudança
- **Quando** revisado
- **Então** nenhuma das 3 importa `PDFDocument`/`StandardFonts`/`rgb` diretamente — todas usam o
  helper compartilhado.

## Casos de borda e erros
- Logo não carrega (fetch falha, offline): PDF ainda gera, sem logo, sem quebrar a exportação —
  degrada, não bloqueia (mesmo princípio de "saúde Auvo indisponível" já usado em outras stories).
- Relatório de 1 página só: cabeçalho/rodapé aparecem normalmente, "Página 1 de 1".

## Fora de escopo
- `pmoc-generate-pdf` (Laudo PMOC, Edge Function Deno) — stack diferente, story futura.
- Mudar o conteúdo/dados de qualquer relatório — só a moldura visual do PDF.
- Publicação/envio — inalterado.

## Rastreabilidade
- Código novo: `apps/web/src/lib/pdf/relatorio-pdf.ts`.
- Código alterado: `pages/RelatorioClientePage.tsx`, `pages/RelatorioDiarioPage.tsx`,
  `pages/RelatorioPlanejamentoPage.tsx` (troca da geração de PDF pelo helper).
- Reusa: assets de `public/logos/` (E00-S04), paleta de `index.css`.
- ADRs relacionados: —
