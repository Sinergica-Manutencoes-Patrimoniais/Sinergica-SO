---
name: spec-E04-S08-regua-cobranca-inadimplencia
description: Contrato — régua de cobrança ativa: lembretes automáticos de recebível vencido/a vencer (D-3/D+3/D+7/D+15) via WhatsApp e e-mail, com registro e escalonamento.
alwaysApply: true
tier: pequeno
---

# Spec — Régua de cobrança / inadimplência ativa

> **Fonte da verdade.** Status: aprovado. Depende de **E04-S04** (contratos + contas a receber).
> Origem: pedido do Lucas (2026-07-20) — usar com clientes de verdade. E04-S04 só tem aging **visual**
> (D+3/7/15); esta story torna a cobrança **ativa**.

## Resumo
O Financeiro passa a **cobrar automaticamente**: envia lembretes de vencimento (a vencer e vencido)
por WhatsApp e/ou e-mail em pontos configuráveis da régua (ex.: D-3, D+3, D+7, D+15), registrando o
que foi enviado e escalando o tom. Reduz inadimplência sem trabalho manual.

## Contexto atual (AS-IS)
- Recebível = `financeiro.lancamentos` (`entrada`/`previsto`/`origem='recorrencia'`, `contrato_id`,
  `data_vencimento`) — E04-S04. Aging D+3/7/15 já calculado (view `aging_recebiveis`).
- Canais: WhatsApp via Evolution (`atendimento-evolution`, E02); e-mail via integração E00-S12 (Resend).
- Contato do cliente em `pcm.clientes` (contato/telefone/email).

## Critérios de aceite

### AC-1: Régua configurável
- **Dado** um `superadmin`/financeiro em Configurações → Cobrança
- **Quando** define os pontos da régua (ex.: D-3, D+3, D+7, D+15), canal por ponto e mensagem-modelo
- **Então** a régua é persistida e passa a reger os envios.

### AC-2: Envio automático por vencimento
- **Dado** recebíveis a vencer/vencidos
- **Quando** o job diário roda
- **Então** para cada recebível que atinge um ponto da régua, dispara o lembrete no canal
  configurado, escopado ao cliente do recebível.

### AC-3: Registro e não-duplicação
- **Dado** um lembrete enviado
- **Quando** o job roda de novo
- **Então** o envio fica registrado (canal, timestamp, recebível) e **não** reenvia o mesmo ponto da
  régua para o mesmo recebível.

### AC-4: Para ao ser pago
- **Dado** um recebível baixado (pago)
- **Quando** a régua avalia
- **Então** não envia mais lembrete para ele.

### AC-5: Degradação sem canal
- **Dado** WhatsApp/e-mail não configurado
- **Quando** o job tenta enviar
- **Então** loga e segue, **nunca** finge envio nem quebra o job (padrão E01-S05).

## Casos de borda e erros
- Cliente sem telefone/e-mail → registra "sem canal", não quebra.
- Recebível com vencimento alterado → recalcula pontos da régua.

## Fora de escopo (vinculante)
- Emissão de boleto/PIX (é E04-S09).
- Negativação/protesto (serviço externo, futuro).
- Enforcement de bloqueio de OS por inadimplência (non-goal do épico — flag existe no contrato).

## Rastreabilidade
- Migration: config da régua + log de envios (por recebível/ponto), RLS FORCE
- Job: pg_cron diário (reusa padrão dos crons de E04-S04) + Edge Function de disparo
- Canais: `supabase/functions/atendimento-evolution` (WhatsApp), integração e-mail E00-S12
- Fonte: `financeiro.lancamentos`/`aging_recebiveis` (E04-S04), `pcm.clientes` (contato)
- Config: Configurações do módulo Financeiro (padrão E01-S80)
