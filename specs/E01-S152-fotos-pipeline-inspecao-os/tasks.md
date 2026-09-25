---
name: E01-S152-fotos-pipeline-inspecao-os-tasks
description: Tasks executáveis para E01-S152
alwaysApply: false
---

# Tasks — E01-S152 — Fotos seguem Inspeção → Backlog → Chamado → OS

Owner: Claude (sessão Lucas) · Início: 2026-08-16

## Confirmações contra o codebase
- `pcm.inspecao_itens.foto_urls jsonb not null default '[]'` (migration `0150`) é o formato de
  referência — mesma coluna/tipo replicada em `ordens_servico`/`chamados`.
- `CriarOrdemServicoInput` (`ordem-servico-gateway.ts:28`) não tem campo de foto — todo campo novo
  aditivo/opcional segue o padrão de `semChamado?`/`chamadoId?` já existentes ali.
- `confirmarGerarBacklog` (`assessment.ts:152`) recebe `item: Pick<InspecaoItem, "id"|"destino"|
  "descricao">` — Pick estreito, precisa alargar pra `"fotoUrls"` (o objeto real passado por
  `InspecoesPage.tsx` já é o `InspecaoItem` completo, não precisa mudar a call site).
- `derivarItemParaChamado` (`assessment.ts:72`) mesmo padrão — Pick alarga pra `"localizacao"` e
  `"fotoUrls"`.
- `criarChamadoAutomatico` (`supabase-ordem-servico-adapter.ts:22`) é o helper compartilhado por
  `criarOrdemServico` (Nova OS manual) e `confirmarChamado` (E01-S151) — ganha params opcionais
  `descricao`/`local`/`fotoUrls`, ambos call sites passam o que tiverem disponível.

## Tarefas

1. **Migration `0210_E01-S152_fotos_pipeline.sql`**: `alter table pcm.ordens_servico add column if
   not exists foto_urls jsonb not null default '[]'::jsonb;` + mesmo para `pcm.chamados`.
2. **`ordem-servico-gateway.ts`**: `CriarOrdemServicoInput` ganha `fotoUrls?: string[]`.
3. **`chamados-gateway.ts`** (`domain/chamados.ts` pro tipo base): `ChamadoFormData` ganha
   `fotoUrls?: string[]`; `Chamado` ganha `fotoUrls: string[]`.
4. **`supabase-hub-os-adapter.ts`**: `COLS` + `OrdemServicoRow` + mapeamento ganham `foto_urls` →
   `fotoUrls`. **`domain/ordens-servico.ts`**: `OrdemServicoOperacional` ganha `fotoUrls: string[]`.
5. **`supabase-ordem-servico-adapter.ts`**:
   - `criarOrdemServico`: insert ganha `foto_urls: input.fotoUrls ?? []`.
   - `criarChamadoAutomatico`: novos params opcionais `descricao`/`local`/`fotoUrls`, inclusos no
     insert de `chamados`.
   - `confirmarChamado`: select da OS ganha `descricao,local_descricao,foto_urls`; repassa pro
     `criarChamadoAutomatico`.
6. **`supabase-chamados-adapter.ts`**: `CHAMADO_COLS`/`ChamadoRow`/`mapChamado` ganham `foto_urls`
   → `fotoUrls`; `criar` insert ganha `foto_urls: input.fotoUrls ?? []`.
7. **`assessment.ts`**:
   - `confirmarGerarBacklog`: Pick do `item` alarga pra incluir `"fotoUrls"`; input de
     `derivarItemParaOsOuBacklog` ganha `fotoUrls: item.fotoUrls`.
   - `derivarItemParaChamado`: Pick do `item` alarga pra incluir `"localizacao"`/`"fotoUrls"`;
     chamada a `gatewayChamados.criar` ganha `local: item.localizacao, fotoUrls: item.fotoUrls`.
8. **`chamados.ts`** (`gerarOsDoChamado`): comando ganha `fotoUrls: chamado.fotoUrls`.
9. **`InspecoesPage.tsx`** (`handleImportar`, caminho `enviarBacklog`): input de
   `derivarItemParaOsOuBacklog` ganha `fotoUrls: item.fotoUrls`.
10. **UI**:
    - `ChamadoPainel.tsx` (`DetalheChamado`): bloco "Fotos" (miniaturas 64×64, link pra original)
      abaixo de "Local", condicional a `chamado.fotoUrls.length > 0`.
    - `OrdensServicoPage.tsx` (painel de detalhe, onde já mostra `Info label="Local"`): mesmo
      bloco condicional a `selecionada.fotoUrls.length > 0`.
11. **Testes**: ajustar fixtures de `assessment.test.ts`/`abrir-ordem-servico.test.ts` que
    constroem `InspecaoItem`/`CriarOrdemServicoInput` literal (adicionar `fotoUrls: []` onde o
    tipo now exige, ou onde faz sentido cobrir o novo carregamento).

## Fora de escopo (reafirmado do spec.md)
Upload novo de fotos em Chamado/OS · composição de texto novo pra `descricao` · `midias` (não-foto).
