---
name: tasks
description: Decomposição e gates — cadastro rico de ferramenta com imagem (sem Storage novo).
alwaysApply: false
---

# Tasks — E01-S65 · Cadastro rico + imagem

> Independente de S63/S64 (pode rodar em paralelo). Marcar owner no ROADMAP.
> Branch: `feat/E01-S65-ferramentas-cadastro-rico`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Testar `PATCH /products/{id}` com `imageUrl` num produto de teste reversível (credencial Auvo real) — documentar resultado nesta pasta (append ao spec.md, seção "Achado técnico") | AC-1 | credencial Auvo | manual (curl) | **não executado** — ação de escrita em produção externa pede confirmação explícita do Lucas antes de rodar (credenciais disponíveis, teste não autorizado nesta sessão). Implementação seguiu o caminho conservador (não aceita escrita) — ver spec.md |
| 2 | `AuvoProduct`/`FerramentaRow` em `_shared/auvo/registry/ferramentas.ts` ganham `imageUrl`/`uriAttachments`/`code` — só em `fromAuvo` (leitura); `toAuvo`/`toAuvoUpdate` explicitamente NÃO incluem `imageUrl` (teste garante isso). Migration `0088` (`imagem_url`/`uri_anexos`/`codigo_auvo`) | AC-1, AC-2 | 1 | `pnpm run test`/`lint:migrations` | **done** |
| 3 | `domain/ferramentas.ts`: `FerramentaItem` ganha `imagemUrl`/`codigoAuvo`/`valorUnitario`/`custoUnitario`; `FerramentaFormData` ganha `valorUnitario`/`custoUnitario` (editáveis — write path já existia em `toAuvoUpdate`, só faltava UI); `validarFerramentaInline` novo (mapa de erros por campo, sem lançar) | AC-2, AC-3 | 2 | `pnpm run test` | **done** |
| 4 | `FerramentasPage.tsx`: card ganha thumbnail (`imagemUrl` ou placeholder) + valor/custo/código Auvo; modal ganha preview de imagem (read-only, com aviso "cadastre no Auvo"), valor/custo unitário editáveis, categoria com busca (`<input list>` + `<datalist>`, autocomplete nativo), validação inline (erro por campo antes de submeter, botão desabilitado se houver erro) | AC-2–AC-4 | 3 | `pnpm run test` | **done** |
| 5 | Gates + ROADMAP/STATE | todos | 1–4 | `biome check --write .`, `typecheck`, `test` (320 passando), `build`, `arch:check`, `lint:migrations`, `check:edge-functions`, `audit:esteira`, `eval:spec`, `validate-mermaid` | **done, todos verdes** — verificação visual não realizada (sem Playwright neste ambiente) |

## Plano de teste
- Unit: validação de URL de imagem (vazio ok, URL inválida rejeitada).
- Manual: comparar o que a task 1 confirmou contra o comportamento real da tela.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · ROADMAP/STATE atualizados
- [ ] Resultado da task 1 documentado no `spec.md` (não deixar "não confirmado" pendurado)
