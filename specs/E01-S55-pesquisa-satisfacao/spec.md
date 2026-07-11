---
name: spec
description: Contrato — espelho de respostas de pesquisa de satisfação (/satisfactionsurveys) por OS/cliente (CSAT/NPS operacional).
alwaysApply: true
---

# Spec — Pesquisa de satisfação do Auvo no PCM

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Origem: `docs/AUDITORIA-AUVO-API.md`. A API expõe `GET /satisfactionsurveys` (resposta por
> `taskId`: pergunta, resposta, score, e-mail, data). **Achado da navegação real:** a conta tem o
> recurso configurável mas 0 respostas — a pesquisa nunca foi ativada. A story entrega o espelho e
> a visibilidade; **ativar o envio é ação de operação no Auvo** (config da conta), documentada como
> pendência humana, não bloqueio de código.

## Resumo
Espelho `pcm.satisfacao_respostas` ligado à OS pelo `taskId`; nota média por cliente na 360 e
card no dashboard; alerta visual para resposta ruim (score baixo) na lista de OS. Alimenta futuro
churn (§6.11) e o relatório mensal (§6.1).

## Critérios de aceite

### AC-1: Espelho idempotente
- **Dado** o pull rodando
- **Quando** sincroniza
- **Então** `pcm.satisfacao_respostas` reflete o Auvo (unique `auvo_id`), resposta ligada à OS via
  `auvo_task_id` quando existir

### AC-2: Nota na 360
- **Dado** um cliente com respostas
- **Quando** a 360 carrega
- **Então** mostra média e últimas respostas (data, OS, score, comentário)

### AC-3: Estado vazio honesto
- **Dado** a conta sem respostas (estado atual)
- **Quando** qualquer tela de satisfação carrega
- **Então** explica que a pesquisa do Auvo ainda não está ativa e o que fazer (config no Auvo),
  em vez de "0" mudo

### AC-4: Destaque de detrator
- **Dado** uma resposta com score baixo (limiar no domínio, configurável em código)
- **Quando** listada
- **Então** destacada visualmente na 360 e no painel da OS

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Disparar/gerenciar o envio da pesquisa (é config/ação do Auvo; futuro CS via WhatsApp é §6.2 agente CS).
- NPS formal (cálculo promotor/detrator sobre base própria) — precisa de volume primeiro.

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · ESCOPO-MESTRE §6.2 (CS), §6.11 (churn), dor L7.
- Contrato API: `GET /satisfactionsurveys` — verificar payload real com credencial antes da migration.
- Arquivos-âncora: registry/pull, `apps/web/src/features/pcm/` (360 + dashboard).
