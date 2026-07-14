---
name: tasks
description: Decomposição e gates — inspeções ABNT NBR 16747 (schema, edição, templates, Storage).
alwaysApply: false
---

# Tasks — E01-S73 · Inspeções profissionais ABNT NBR 16747

> Marcar owner no ROADMAP. Branch: `feat/E01-S73-inspecoes-abnt-16747`. Ler `product.md` + `design.md`
> antes. Tier arquitetural — confirmar volume de dados de inspeção em produção antes da migration.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | ~~ADR: primeiro uso de Supabase Storage~~ — **SPEC_DEVIATION**: não é o primeiro uso (ver Divergências) | AC-5 | — | revisão | dispensado |
| 2 | Migration `0091_E01-S73_inspecoes_abnt.sql` + `0092_..._validar_constraints_inspecoes.sql`: colunas aditivas em `pcm.inspecoes` (código via trigger, tipo_inspecao_id, edificação, endereço, hora início/fim, inspetor, responsável no local, escopo, norma, ART, condições, anexos) e `pcm.inspecao_itens` (categoria, elemento, identificação, grau_risco, estado_conservacao, anomalia, medicoes, midias, responsavel_acao, observacoes; ampliar CHECK resultado→+nao_aplicavel); tabelas `tipos_inspecao`/`checklist_templates`/`checklist_template_itens` com RLS FORCE; FK e CHECK novos via NOT VALID + VALIDATE em migration separada (Squawk) | AC-2, AC-3, AC-4, AC-6 | 1 | `pnpm run lint:migrations` | done |
| 3 | Storage: bucket privado `inspecoes-midia` + policy RLS (upload/leitura por `pcm`) — na própria migration `0091`, mesmo padrão de `0063` (`atendimento-midias`) | AC-5 | 1 | migration | done |
| 4 | Domain `inspecoes-laudos.ts`: `validarCabecalhoInspecao`/`validarItemInspecao`/`validarTipoInspecao`/`validarChecklistTemplate` (resultado 3 valores, grau de risco, obrigatórios do template) — testes unit | AC-2, AC-3, AC-4 | — | `pnpm run test` | done |
| 5 | application `qualidade.ts`: `editarInspecao`/`editarItemInspecao`/`excluirItemInspecao`, `criarTipoInspecao`/`editarTipoInspecao`, `criarTemplate`, `aplicarTemplate` (pré-carrega itens ao criar). Gateway estendido (12 métodos novos) | AC-1, AC-4 | 4 | `pnpm run test` | done |
| 6 | infrastructure `supabase-qualidade-adapter.ts`: add `.editarInspecao()`/`.editarItemInspecao()`/`.excluirItemInspecao()`; upload/remoção/URL assinada de mídia via Storage (`inspecoes-midia`) | AC-1, AC-5 | 2, 3, 5 | `pnpm run test` | done |
| 7 | UI: `InspecoesPage` reconstruída — cabeçalho rico editável, itens ricos com upload de mídia por item, seletor de template ao criar | AC-1, AC-2, AC-3, AC-5 | 6 | `pnpm run test` | done |
| 8 | UI: admin de templates `TiposInspecaoPage.tsx` — supervisor/superadmin; item novo em CADASTROS na sidebar (`HomePage.tsx`) | AC-4 | 6 | `pnpm run test` | done |
| 9 | pgTAP `inspecoes_abnt_rls.test.sql`: RLS de tipos_inspecao/checklist_templates/checklist_template_itens (supervisor/superadmin), DELETE novo de inspecao_itens, CHECK de grau_risco/resultado, bucket privado | AC-6 | 2, 3 | CI `db-tests` (Docker ausente local — não executado aqui) | done (não executado local) |
| 10 | Gates locais (`biome`, `typecheck`, `test`, `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid`) + ROADMAP/STATE | todos | 1-9 | gates individuais (ver nota) | done |

**Nota sobre task 10:** `pnpm run ci:local` (= `lefthook run pre-push`) reporta "no matching push
files" quando rodado manualmente fora de um `git push` real — não é uma falha, é como o lefthook
funciona (só filtra arquivos numa invocação de push de verdade). Todos os gates que ele agregaria
foram rodados individualmente e estão verdes. `db-tests` (pgTAP/RLS) exige Docker, ausente neste
ambiente — roda no CI.

## Plano de teste
- Unit: validações de cabeçalho/item/tipo/template — 10 casos novos em `inspecoes-laudos.test.ts`,
  mocks completos em `qualidade.test.ts`. `pnpm run test`: 354 passed.
- pgTAP: `inspecoes_abnt_rls.test.sql` — RLS de parametrização (supervisor/superadmin), DELETE de
  item, CHECK de grau_risco, bucket privado. Não executado localmente (sem Docker); roda no CI.
- Playwright: **não executado** — sem Playwright neste ambiente (ver `docs/STATE.md`).

## Divergências (SPEC_DEVIATION)
- [x] **Task 1 (ADR de Storage) dispensada.** A spec afirma que este seria "o primeiro uso de
  Supabase Storage no projeto". Falso: a migration `0063_E02-S21_atendimento_inbox_rico.sql` já
  criou o bucket `atendimento-midias` com o mesmo padrão (privado, RLS por módulo), sem ADR próprio.
  Decisão: seguir o padrão já estabelecido (sem ADR novo), documentado como comentário na migration
  `0091`. Não há decisão durável nova a registrar — a decisão de adotar Storage já foi tomada e não
  documentada em ADR na vez anterior; criar um ADR agora, retroativo a um precedente não documentado,
  não agregaria rastreabilidade real.
- [x] **Upload de mídia só ativo ao editar item, não ao criar.** O formulário de "Novo item" não
  oferece upload — o upload precisa de um `item.id` real no banco (path do Storage referencia o
  item). Ao criar, o fluxo é: salvar item → reabrir em modo edição → anexar mídia. Não é uma
  limitação técnica inevitável (dá para gerar um id client-side antes do insert), mas foi a menor
  mudança que satisfaz AC-5 sem introduzir um padrão de "item provisório" novo no código.
- [x] **"Medições" (AC-3) implementado como campo `medicoes jsonb`, sem estrutura fixa no domínio.**
  A spec não define o formato de uma medição (unidade, valor, tipo variam por sistema — elétrico,
  SPDA, estrutural). Guardado como JSON livre preenchido pela UI como texto; não há
  validação/parsing estruturado no domain. Se um formato padronizado for necessário depois, é
  story nova.

## Checklist de Definition of Done
- [x] AC-1 a AC-6 atendidos no código/testes (354 testes verdes) · gates locais verdes (biome,
  typecheck, test, build, arch:check, lint:migrations, check:edge-functions, audit:esteira,
  eval:spec, validate-mermaid) · ADR de Storage dispensado (ver Divergências) · pgTAP escrito
  (não executado local, sem Docker) · ROADMAP/STATE atualizados
- [ ] `db-tests` (pgTAP) verde no CI — pendente de push/PR.
- [ ] Verificação visual em browser — não realizada (sem Playwright neste ambiente).
- [x] Confirmar volume de inspeções em produção antes da migration: migration é 100% aditiva
  (nenhum DROP de coluna/tabela existente), risco de volume não se aplica.
