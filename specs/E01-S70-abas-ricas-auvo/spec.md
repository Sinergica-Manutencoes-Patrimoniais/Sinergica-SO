---
name: spec
description: Contrato — trazer e exibir no PCM todas as abas ricas da tarefa Auvo (Relato, Anexos/Fotos, Questionários, Equipamentos, Pendências, Horas, Valores), incluindo respostas de questionário e fotos de verdade.
alwaysApply: true
---

# Spec — E01-S70 · Detalhe completo da tarefa Auvo no PCM (todas as abas)

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> Origem: teste de produção do Lucas (2026-07-14) — "as tarefas do Auvo têm um questionário
> preenchido com os detalhes, precisamos ver isso; e tem muitas outras abas (Relato, Anexos,
> Questionários, Equipamentos, Pendências, Controle de horas, Envios, Valores)". "Não está trazendo
> nenhuma das fotos do Auvo."

## Achado técnico (verificado na API Auvo real, 2026-07-14)
O `GET /tasks` **já retorna** `questionnaires[]` com `answers[]` (`questionId`, `questionDescription`,
`reply`, `replyDate`), além de `attachments[]`, `signatureUrl`, `products[]`, `services[]`,
`additionalCosts[]`, `keyWords[]`, `timeControl`, `pendency`, `report`, `expense`,
`financialCategory`. **Não precisa de endpoint separado para questionários** — só capturar.
- `montarDetalhes` (`pcm-auvo-tasks-import/index.ts:337-370`) **não captura** `questionnaires`,
  `keyWords`, `timeControl`, campos financeiros.
- `DetalhesTarefaAuvo` (função interna de `OrdensServicoPage.tsx:729-878`) mostra produtos/serviços/
  anexos **só como CONTAGEM** (`:820-835`), **não renderiza fotos**, e está preso à página de OS.

## Resumo
(1) `montarDetalhes` passa a capturar os campos faltantes (questionários, keyWords, timeControl,
financeiros). (2) `DetalhesTarefaAuvo` é extraído para componente compartilhado que renderiza de
verdade: questionários (pergunta→resposta→data), fotos (`<img>` das URLs de `anexos`/`signatureUrl`),
lista de produtos/serviços/custos. (3) O detalhe da OS (usado por E01-S69) mostra abas espelhando o
Auvo: Relato, Anexos/Fotos, Questionários, Equipamentos, Pendências, Horas, Valores. Fotos são URLs
S3 do Auvo (sem Storage).

## Critérios de aceite

### AC-1: Capturar questionários e campos faltantes
- **Dado** o sync de tarefas rodando
- **Quando** uma tarefa Auvo tem `questionnaires`/`keyWords`/`timeControl`/campos financeiros
- **Então** `auvo_detalhes` passa a incluir `questionarios` (lista de pergunta/resposta/data),
  `palavrasChave`, `controleHoras` e valores — capturados em `montarDetalhes` (só chaves presentes,
  nunca inventar default, mesmo padrão atual)

### AC-2: Componente de detalhe compartilhado
- **Dado** `DetalhesTarefaAuvo` hoje interno de `OrdensServicoPage`
- **Quando** extraído para `features/pcm/components/`
- **Então** é reutilizável (OS, Backlog via E01-S69, cliente-360) e não há segundo painel duplicado

### AC-3: Questionários renderizados
- **Dado** uma OS cuja tarefa Auvo tem questionário preenchido
- **Quando** o detalhe abre na aba Questionários
- **Então** mostra cada pergunta com sua resposta e data/autor (como a aba "Questionários" do Auvo),
  não apenas contagem

### AC-4: Fotos renderizadas
- **Dado** uma OS com `anexos` (URLs de imagem) e/ou `assinaturaUrl`
- **Quando** o detalhe abre na aba Anexos/Fotos
- **Então** as imagens aparecem (`<img>` com as URLs S3 do Auvo, thumbnail + abrir maior), não só um
  link "ver imagem"

### AC-5: Abas espelhando o Auvo
- **Dado** o detalhe de uma OS vinda do Auvo
- **Quando** aberto
- **Então** organiza o conteúdo em abas: Relato, Anexos/Fotos, Questionários, Equipamentos,
  Pendências, Horas (duração/check-in/out), Valores (produtos/serviços/custos/despesa). Abas sem
  dado mostram estado vazio honesto, não somem sem explicação

## Fora de escopo
> Vinculante.
- Apontamento de horas agregado por cliente/técnico (visão de custo) — E01-S72 (aqui só a aba Horas
  da OS individual).
- Imagem de equipamento (catálogo) — E01-S71.
- Buscar endpoints Auvo separados (`/tasks/{id}/attachments` etc.) — não necessário, o payload de
  `/tasks` já traz o que precisamos; se algum anexo faltar, fica como débito para E01-S57.
- Storage — fotos são URLs do Auvo.

## Rastreabilidade
- Origem: teste Lucas 2026-07-14; API Auvo real confirmou `questionnaires` no GET /tasks.
- Arquivos-âncora: `supabase/functions/pcm-auvo-tasks-import/index.ts` (`montarDetalhes`, interface
  `AuvoTask`), `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx:729-878` (`DetalhesTarefaAuvo`
  → extrair), novo `apps/web/src/features/pcm/components/DetalhesTarefaAuvo.tsx`,
  `apps/web/src/features/pcm/domain/ordens-servico.ts` (tipo `detalhes`).
- Depende de: nada rígido, mas combina com E01-S69 (o detalhe compartilhado abre pelo clique).
