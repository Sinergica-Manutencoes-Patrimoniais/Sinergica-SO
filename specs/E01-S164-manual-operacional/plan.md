# Implementation Plan: Manual operacional

**Branch**: `feat/E01-S164-manual-operacional` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

## Summary

Substituir a apresentação resumida de PCM por manual por tarefas no Guia do SO. Conteúdo estático em `features/guia/pcm-manual.ts`; interface com índice pesquisável e assunto selecionado por fragmento. Links no PCM usam `/?guia=pcm#pcm-<assunto>` em outra aba. `HomePage` inicializa o guia pelo parâmetro conhecido, sem importar o guia a partir do PCM.

## Technical Context

- TypeScript, React 19, Tailwind/tokens e lucide-react existentes, sem dependências novas.
- Conteúdo sem I/O, autenticação existente e zero mudança em banco/RLS/Auvo.
- Vitest/Testing Library para busca, navegação e fallback; Playwright somente leitura para abrir ajuda em outra aba e chegar ao assunto.
- Índice e leitura lado a lado em desktop; empilhados no mobile.
- Controles nativos, foco visível e aviso de outra aba. Busca ignora acentos/caixa; artigo selecionado continua consultável durante a pesquisa.

## Constitution Check

PASS antes/depois do desenho: sem servidor/schema novo; shell compõe navegação entre features; ajuda local no PCM é link estático. Termos de `docs/glossary.md`, sem termos novos. Conteúdo baseado nos formulários/ações atuais. Sem ADR necessário.

## Project Structure

- `apps/web/src/features/guia/pcm-manual.ts`: conteúdo por assunto.
- `apps/web/src/features/guia/PcmGuia.tsx`: busca, índice, passos, conferência e dúvidas.
- `apps/web/src/features/pcm/components/AjudaPcm.tsx`: link discreto.
- `apps/web/src/app/HomePage.tsx`: abertura direta do guia PCM.
- Formulários PCM e páginas VisaoClientePage/OrdensServicoPage: link contextual.
- Testes: `features/guia/PcmGuia.test.tsx` e `e2e/manual-pcm.spec.ts`.

## Delivery

Conteúdo/consulta (US1), links/abertura direta (US2), verificação visual e `ci:local`. A branch inclui o ajuste anterior de identificador para o manual descrever o comportamento entregue. Sem alteração operacional.
