---
name: spec-E01-S98-analise-ia-questionario-assessment
description: Contrato — rodar a análise por IA no import de questionário Auvo do Assessment, igual ao import de XLS.
alwaysApply: true
tier: pequeno
---

# Spec — Análise IA no import de questionário Auvo (Assessment)

> **Fonte da verdade.** Status: aprovado
> Origem: Lucas, sessão 2026-07-24. "Esse mesmo fluxo de análise deve acontecer no assessment, onde
> virá do questionário as informações da planilha" — confirmado via pergunta direta: quer a mesma
> análise por IA do import de XLS (E01-S96), não só o fix de múltiplas fotos (E01-S97).

## Resumo
Hoje `importarQuestionarioAuvo` (`supabase-qualidade-adapter.ts:930-994`) mapeia cada pergunta do
questionário Auvo (`pcm.auvo_task_snapshots.checklist`) 1:1 em item de inspeção, sem nenhuma
classificação: `descricao` = `"pergunta: resposta"`, `severidade` sempre `"media"`, sem GUT/
título/categoria. Esta story substitui a inserção direta por um round-trip pela mesma IA do import
de XLS (`processarRelatorioInspecao`, Edge Function `importar-relatorio-pdf`, E01-S96): compõe um
texto com todas as perguntas/respostas/fotos do questionário e deixa a IA extrair as inconformidades
reais, com GUT/título/categoria — mesmo formato que `criarInspecaoImportada` já usa (E01-S97: também
grava `foto_urls` completo, não só a primeira).

## Decisões de escopo (Lucas, 2026-07-24 — não são achado de código, são decisão de produto)

1. **IA processa TODAS as perguntas do questionário**, não só as com resposta negativa/problemática.
   O texto enviado à IA inclui pergunta+resposta+fotos de cada questão, igual ao formato usado no
   import de XLS (`Local/Fotos/Relato`). A IA decide o que é inconformidade real — perguntas "tudo
   certo" tendem a não gerar item, mudando o comportamento atual (hoje toda pergunta vira item, sem
   filtro).
2. **Idempotência muda de por-pergunta para por-importação inteira.** O mecanismo antigo
   (`auvo_questao_chave` único por pergunta, checado antes de inserir cada uma) não funciona mais —
   a IA filtra/reagrupa livremente, perdendo o vínculo 1:1 pergunta→item. A partir desta story,
   `importarQuestionarioAuvo` bloqueia reimportar se o assessment já tiver qualquer item vindo de
   questionário (qualquer `auvo_questao_chave` não nulo já presente pra este `inspecaoId`).
   Reimportar exige apagar os itens antigos manualmente primeiro (fora de escopo automatizar isso).

## Critérios de aceite

### AC-1: Texto completo do questionário vai para a IA
- **Dado** um questionário Auvo com N perguntas
- **Quando** o assessment importa o questionário
- **Então** o texto enviado a `processarRelatorioInspecao` contém pergunta+resposta+fotos de todas
  as N perguntas (não filtradas antes do envio).

### AC-2: Itens gravados vêm classificados pela IA
- **Dado** a IA retorna itens estruturados (GUT, título, categoria, sistema, fotos)
- **Quando** os itens são persistidos
- **Então** `pcm.inspecao_itens` grava `severidade` calculada por GUT (não mais fixa "media"),
  `foto_url`/`foto_urls` (lista completa, reusa E01-S97), `descricao` vinda da classificação da IA
  — mesmo formato de linha que `criarInspecaoImportada` já usa.

### AC-3: Bloqueia reimportação do mesmo questionário
- **Dado** um assessment que já tem item(ns) com `auvo_questao_chave` não nulo (import anterior)
- **Quando** o usuário tenta importar questionário de novo para o mesmo assessment
- **Então** a operação é bloqueada com mensagem clara ("questionário já importado"), sem round-trip
  de IA nem inserção duplicada.

### AC-4: Questionário sem inconformidade real não quebra o fluxo
- **Dado** a IA retorna zero itens (todas as respostas eram "conforme")
- **Quando** o import termina
- **Então** nenhum item é inserido e a operação não lança erro — retorna a lista de itens existente
  (vazia ou não) normalmente.

## Fora de escopo (vinculante)
- Automatizar "apagar itens antigos pra reimportar" — usuário exclui manualmente item por item
  (ação já existente na tela) se quiser reimportar.
- Mudar o fluxo de import de XLS (`criarInspecaoImportada`) — só reusa o helper de mapeamento de
  linha, sem alterar comportamento existente.
- Filtrar perguntas antes de mandar pra IA (decisão 1 acima: vai tudo).

## Rastreabilidade
- `apps/web/src/features/pcm/infrastructure/supabase-qualidade-adapter.ts` (`importarQuestionarioAuvo`, helper `linhaItemImportado` extraído de `criarInspecaoImportada`)
- `apps/web/src/features/pcm/domain/assessment.ts` (`QuestaoAuvo`, sem mudança de forma)
