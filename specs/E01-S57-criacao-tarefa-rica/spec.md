---
name: spec
description: Contrato — criação de tarefa rica no Auvo (anexo de contexto, produtos previstos, keywords) a partir da OS do PCM.
alwaysApply: true
---

# Spec — Criação de tarefa rica: OS do PCM chega completa no técnico

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno/Médio
> Origem: `docs/AUDITORIA-AUVO-API.md`. Hoje `pcm-auvo-create-task` cria a tarefa "magra"
> (cliente, tipo, descrição, técnico, data). A API aceita muito mais:
> `PUT /tasks/{id}/attachments` (anexos), `PUT /tasks/{id}/products` (produtos previstos),
> `PUT /tasks/{id}/services`, keywords no POST. Dores T1 ("ordem vaga, sem contexto") e T3
> ("retrabalho por falta de peça") do ESCOPO-MESTRE seguem abertas na ida PCM→Auvo.

## Resumo
Ao planejar uma OS, o PCM passa a enviar junto: (a) **anexo de contexto** (resumo do histórico do
equipamento/cliente e descrição rica — PDF/texto gerado do dado que a 360 já tem); (b) **produtos
previstos** (peças separadas para a visita, quando informadas); (c) **keywords** da OS. Falha em
etapa de enriquecimento não desfaz a tarefa criada — degrada com log e sinalização na OS.

## Critérios de aceite

### AC-1: Anexo de contexto
- **Dado** uma OS com equipamento/cliente com histórico
- **Quando** vira tarefa no Auvo
- **Então** a tarefa recebe um anexo de contexto (histórico resumido; formato definido na
  implementação — texto/PDF), e o técnico o vê no app

### AC-2: Produtos previstos
- **Dado** uma OS com peças previstas informadas
- **Quando** vira tarefa
- **Então** `PUT /tasks/{id}/products` registra os produtos (ids do espelho `pcm.ferramentas`/produtos)

### AC-3: Falha parcial não quebra o fluxo
- **Dado** a tarefa criada e um enriquecimento falhando (ex.: 400 no attachments)
- **Quando** o push processa
- **Então** a OS continua sincronizada, o erro fica registrado (outbox/status) e visível na UI —
  nunca duplicar a tarefa por retry do enriquecimento

### AC-4: Idempotência preservada
- **Dado** reenvio da mesma OS
- **Quando** o caminho roda de novo
- **Então** não duplica tarefa nem anexos (chave idempotente por OS + tipo de enriquecimento)

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Editor de peças/estoque completo (módulo Estoque §6.4 — aqui é só o vínculo previsto→tarefa).
- `additional-costs` e `questionnaire-response` write (sem caso de uso na ida ainda).
- Flip de `writeEnabled` de outras entidades (E01-S47).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · ESCOPO-MESTRE §2.3 T1/T3, §6.1 (OS Kanban + sync).
- Contrato API: `PUT /tasks/{id}/attachments|products|services` — **verificar formato real (base64?
  URL? multipart?) com credencial e tarefa de teste antes de implementar**.
- Arquivos-âncora: `supabase/functions/pcm-auvo-create-task/`, `_shared/auvo/client.ts`,
  modal de Nova OS (`features/pcm`).
