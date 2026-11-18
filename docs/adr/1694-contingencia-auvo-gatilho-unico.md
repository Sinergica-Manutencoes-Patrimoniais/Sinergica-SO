---
name: "docs-adr-1694-contingencia-auvo-gatilho-unico-md"
description: "Documento Sinérgica SO: ADR-1694 — Criação manual de tarefa Auvo vira contingência auditada (E01-S196)"
alwaysApply: false
---

# ADR-1694 — Criação manual de tarefa Auvo vira contingência auditada (E01-S196)

**Status:** aceita · **Data:** 2026-11-18 · **Story:** E01-S196 · **Tier:** arquitetural (integração externa)

## Contexto

BL 004 pede **um gatilho normal**: confirmação do PCM agenda o envio pra T−24; dentro da janela,
envia na hora. A metade difícil (`1844_E01-S168_cron_despacho_t24.sql` +
`pcm-auvo-t24-despachar`, com 3 travas independentes de contrato comprovado) já existia e está
testada — AC-1 a AC-8 dependem dessa mecânica, não reescrita aqui (achado: "não reimplementar",
mesma lição da E01-S191).

O que restava: dois **gatilhos concorrentes** vivos.
- `pcm-auvo-create-task` (automático, trigger `pg_net` em `planejamento`) — já tem trava própria
  (`SSO_BLOQUEAR_ENVIO_LEGADO_AUVO`), é rollout, não é caminho humano, fora do escopo de
  contingência.
- `pcm-auvo-open-task` ("Abrir no Auvo", manual) — só exigia módulo `pcm:escrita` genérico. Era o
  caminho realmente aberto a qualquer escritor, sem capacidade própria, sem motivo, sem
  auditoria — o mesmo achado de módulo-não-basta da E00-S26/E00-S27/E01-S192/E01-S194, agora no
  domínio de integração externa.

## Decisão

- Nova ação `execucao.contingencia_auvo` (`exige_concessao_individual=true`, mesmo padrão
  E01-S170). `pcm-auvo-open-task` continua existindo — vira contingência: exige essa capacidade
  própria, motivo obrigatório, idempotente por `request_id`, auditado em `audit.events`.
- A checagem roda num client Supabase no contexto do **usuário** (anon key + Authorization
  repassado), não no `service_role` que o resto da função usa pra ler OS/chamar o Auvo — é o que
  faz `auth.uid()` dentro da RPC ser o ator real. Mesmo padrão já usado em `requireAuth`
  (`_shared/auth.ts`), só não tinha sido estendido pra uma checagem de capacidade de domínio.
- O preview (`dryRun=true`) continua só exigindo módulo genérico — não é "uso", não grava, não
  chama o Auvo; só a confirmação de verdade exige a capacidade de contingência.

## AC-1 a AC-8 — não reimplementados, confirmados por leitura

A mecânica T−24 (idempotência por `externalId`, reprogramação atualiza em vez de duplicar,
retorno pra Demanda preserva a tarefa, retry/alerta sem apagar planejamento) já é coberta pelos
testes da própria E01-S168. Não reproduzidos aqui — **SPEC_DEVIATION**: um teste ponta a ponta
cobrindo os 9 cenários do SC-001 (antes de T−24, dentro da janela, repetição, timeout,
indisponibilidade, reprogramação, cancelamento, retorno atrasado, concorrência) exigiria um
ambiente de testes isolado contra o contrato real do Auvo (ver SEC-006, docs/SECURITY_DEBT.md) —
fora do que esta story consegue provar com segurança sem credencial real. Fica registrado como
verificação pendente antes de homologação formal, não como lacuna de código.

## AC-11 — monitor de exceções, parcial

Só "uso de contingência" ganhou leitura consolidada (`sso_listar_contingencias_auvo`). As outras
três categorias (Visita não confirmada, falha de envio, tarefa órfã) não têm consulta
consolidada em lugar nenhum do sistema — construir as quatro juntas num monitor é trabalho de UI
maior que não coube nesta story. **SPEC_DEVIATION**, achado registrado pra continuação.

## Consequências

- Positiva: fecha o gatilho concorrente humano com capacidade+motivo+auditoria, provado em
  pgTAP; não duplica nem reescreve a mecânica T−24 já testada.
- Negativa/aceita: SC-001 (prova ponta a ponta completa) e o monitor consolidado (AC-11) ficam
  como verificação/trabalho pendente, documentados, não silenciosos.
- Reversível: ação, tabela e funções novas, aditivas; `pcm-auvo-open-task` preserva 100% do
  comportamento anterior pro preview, só a confirmação ganha a exigência nova.

## Referências

Migration `1863_E01-S196_contingencia_auvo.sql` · `specs/E01-S196-gatilho-unico-auvo/` ·
`1844_E01-S168_cron_despacho_t24.sql` (mecânica reusada) · ADR-1690/1691 (mesmo padrão de
achado "módulo não basta").
