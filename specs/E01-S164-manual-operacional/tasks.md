# Tasks: Manual operacional

## Phase 1 — Setup
- [x] T001 Registrar owner e escopo em `docs/epics/ROADMAP.md` e `specs/E01-S164-manual-operacional/spec.md` (AC-1 a AC-6).

## Phase 2 — Fundação
- [x] T002 Definir assuntos estáticos em `apps/web/src/features/guia/pcm-manual.ts` com IDs únicos e referências válidas (AC-4, AC-6).

## Phase 3 — US1: manual por tarefa (MVP)
- [x] T003 [US1] Escrever Chamados, OS, backlog e Auvo em `apps/web/src/features/guia/pcm-manual.ts` (AC-1, AC-4).
- [x] T004 [US1] Escrever Cliente 360, preventivas, ferramentas e rotina em `apps/web/src/features/guia/pcm-manual.ts` (AC-2, AC-4).
- [x] T005 [US1] Escrever Estrutura, Componentes, Sistemas e Identificador em `apps/web/src/features/guia/pcm-manual.ts` (AC-3, AC-4).
- [x] T006 [US1] Implementar índice, busca, artigo e dúvidas em `apps/web/src/features/guia/PcmGuia.tsx` e teste de interação `PcmGuia.test.tsx` (AC-4, AC-6).

## Phase 4 — US2: ajuda contextual
- [x] T007 [US2] Reconhecer guia PCM em `apps/web/src/app/HomePage.tsx` e criar `apps/web/src/features/pcm/components/AjudaPcm.tsx` (AC-5, AC-6).
- [x] T008 [US2] Inserir ajuda nas páginas e formulários PCM definidos no plano (AC-5).
- [x] T009 [US2] Verificar destino, teclado, nova aba e preservação do formulário em `apps/web/e2e/manual-pcm.spec.ts` (AC-5, AC-6).

## Phase 5 — Validação
- [x] T010 Executar `specs/E01-S164-manual-operacional/quickstart.md`, revisar leitura responsiva e `ci:local` (AC-1 a AC-6).

## Evidências

- Vitest focado: 20 testes verdes (manual, modal de Componente e workspace de Preventivas); os 4 testes do manual reexecutados após revisão de conteúdo, verdes.
- Playwright `e2e/manual-pcm.spec.ts`: 3 jornadas e autenticação aprovadas (4/4, 45,2 s); cobre os seis pontos de entrada do AC-5, nova aba, rascunho preservado, mobile e teclado. Sem gravação de dados operacionais.
- `pnpm run ci:local`: todos os gates verdes, incluindo testes, lint, arquitetura, fidelidade, tipagem e build (79,28 s).
- Leitura visual conferida em capturas desktop e mobile; busca ajustada para o ícone não cobrir o texto.
- `graphify` indisponível nesta máquina; mapa não regenerado. Sem mudança de backend, schema ou integração.
- Publicação encaminhada pela conexão GitHub do aplicativo, autenticada; o token da CLI continua inválido. A entrega inclui como base o ajuste anterior de Identificador (`38165d2`).

## Dependências e estratégia

T001 → T002 → T003/T004/T005 → T006 → T007 → T008 → T009 → T010. Conteúdo por tarefa pode ser revisado independentemente; executar sequencialmente nesta sessão. US1 é o MVP, US2 adiciona acesso no ponto de dúvida. Sem necessidade de agentes paralelos.
