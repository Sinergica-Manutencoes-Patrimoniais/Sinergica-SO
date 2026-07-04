---
name: spec-E01-S15-webhook-os-rico
description: Contrato da feature E01-S15 — captura rica do webhook de conclusão de OS Auvo, sem Storage local de anexos.
alwaysApply: false
---

# Spec — E01-S15 Webhook de OS Rico

> Fonte da verdade. Status: aprovado para implementação nesta sessão (2026-07-04).
> Tier: Pequeno. Estende `E01-S10` e reaproveita a autenticação HMAC já existente em
> `pcm-auvo-webhook`. **Não usa Supabase Storage**: anexos/fotos ficam como metadados e URL/referência
> do Auvo quando o payload trouxer essa informação.

## Resumo
Quando o Auvo envia um webhook de Task, especialmente na conclusão, o PCM deixa de salvar apenas a
mudança de status da OS e passa a registrar um snapshot rico do payload recebido: relato do usuário,
anexos/fotos, checklist/questionário preenchido, peças consumidas, controle de horas e timeline
operacional (recebida, visualizada, check-in, check-out). O snapshot é read-only e serve para a
Visão 360/financeiro/PMOC consultarem o que foi executado em campo sem criar uma segunda verdade.

## Critérios de aceite

### AC-1: Webhook continua validando assinatura antes de salvar qualquer snapshot
- **Dado** uma requisição sem assinatura Auvo válida
- **Quando** `pcm-auvo-webhook` recebe o corpo
- **Então** nenhum snapshot rico é inserido/atualizado e a resposta continua `401`, preservando
  `E01-S10` AC-1.

### AC-2: Webhook de conclusão persiste snapshot rico vinculado à OS
- **Dado** uma OS com `auvo_task_id` conhecido
- **Quando** chega um webhook de Task mapeado para `status = 'finalizado'`
- **Então** o PCM faz upsert de um registro em `pcm.auvo_task_snapshots` vinculado a
  `ordem_servico_id` e `auvo_task_id`, contendo `payload_raw` e os campos normalizados disponíveis.

### AC-3: Campos ricos são extraídos de forma defensiva, sem depender de um único shape
- **Dado** que o shape real de entrega do webhook Auvo ainda não foi confirmado neste ambiente
- **Quando** o payload trouxer campos plausíveis para relato, anexos, checklist, peças, horas ou
  timeline
- **Então** o PCM preserva esses dados como JSONB/text/timestamps, tentando nomes conhecidos e
  mantendo o `payload_raw` completo para não perder informação.

### AC-4: Anexos/fotos não são salvos no Storage do SO
- **Dado** o payload traz anexos/fotos
- **Quando** o snapshot é salvo
- **Então** o PCM salva apenas metadados e URLs/referências vindas do Auvo; se o payload não trouxer
  URL/referência consultável, o item fica registrado no JSONB como recebido, sem baixar binário nem
  criar bucket/policy.

### AC-5: Reentrega do webhook atualiza o mesmo snapshot, sem duplicar
- **Dado** um snapshot já existente para `auvo_task_id`
- **Quando** o Auvo reentrega o mesmo evento ou envia payload mais completo da mesma task
- **Então** o upsert atualiza o registro existente por `auvo_task_id`, mantendo uma única linha por
  task Auvo.

### AC-6: Payload rico ausente não quebra a transição de status
- **Dado** o webhook traz apenas `entity`, `action`, `taskId` e `taskStatus`
- **Quando** `pcm-auvo-webhook` processa o evento
- **Então** a OS continua transicionando como em `E01-S10`; o snapshot é salvo com `payload_raw` e
  campos normalizados nulos/vazios, sem erro.

## Fora de escopo
- Criar bucket Supabase Storage, baixar imagens, copiar binários ou gerir política de anexos.
- Gerar PDF/laudo PMOC com fotos/checklist.
- Criar tela própria de detalhe da execução; a Visão 360 pode consumir isto em story posterior.
- Confirmar contrato real do payload Auvo em produção; isto fica como validação operacional.

## Rastreabilidade
- Estende: `../E01-S10-integracao-auvo-webhook-status/spec.md`
- Fundação Auvo: `../E01-S09-integracao-auvo-fundacao/design.md`
- Plano: `docs/STATE.md` seção "Plano — PCM como ferramenta primária..."
