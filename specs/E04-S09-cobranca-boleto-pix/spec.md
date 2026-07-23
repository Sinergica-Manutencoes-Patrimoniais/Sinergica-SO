---
name: spec-E04-S09-cobranca-boleto-pix
description: Contrato — emitir boleto/PIX de um recebível via gateway e dar baixa automática por webhook (HMAC), com credencial no Vault e provedor atrás de porta.
alwaysApply: true
tier: arquitetural
---

# Spec — Cobrança bancária: boleto/PIX

> **Fonte da verdade.** Status: aprovado (após `design.md`). Depende de **E04-S04** e **E00-S12** (Vault).

## Resumo
O Financeiro emite **boleto/PIX** de um recebível por um gateway de pagamento e dá **baixa
automática** quando o cliente paga (webhook validado por HMAC). NF-e continua fora (é cobrança, não
nota fiscal).

## Critérios de aceite

### AC-1: Config do provedor (Vault)
- **Dado** um `superadmin` em Configurações → Cobrança/Integrações
- **Quando** informa credencial do gateway e ambiente (sandbox/prod)
- **Então** a credencial vai pro Vault (write-only, nunca reexibida) e o provedor/ambiente em
  `config.integracoes`.

### AC-2: Emitir cobrança de um recebível
- **Dado** um recebível previsto (E04-S04)
- **Quando** o usuário emite boleto/PIX
- **Então** o gateway cria a cobrança; o sistema guarda o id externo + linha digitável/link/QR PIX em
  `financeiro.cobrancas`, vinculada ao recebível.

### AC-3: Baixa automática por webhook (HMAC)
- **Dado** o cliente paga
- **Quando** o gateway chama o webhook
- **Então** a Edge Function valida HMAC **antes** de qualquer parse, e dá baixa no recebível
  (`realizado`), idempotente por evento; pagamento parcial/estorno/cancelamento tratam o estado
  corretamente.

### AC-4: Reconciliação de webhook perdido
- **Dado** um webhook não entregue
- **Quando** o poll de reconciliação roda
- **Então** o estado da cobrança é sincronizado a partir do gateway (dedupe por id de evento).

### AC-5: Segurança
- **Dado** a integração
- **Quando** revisada
- **Então** credencial só no Vault, webhook rejeita sem HMAC válido, nada sensível em log.

## Casos de borda e erros
- Emitir cobrança de recebível já pago → bloqueia.
- Webhook duplicado → idempotente, não baixa duas vezes.
- Gateway fora do ar → emissão falha com mensagem clara; recebível segue previsto.

## Fora de escopo (vinculante)
- NF-e / nota fiscal de serviço (non-goal D8, story futura).
- Open Finance / conexão bancária direta (non-goal D3).
- Cálculo de taxas do gateway (registro como despesa é opcional, fora deste MVP).

## Rastreabilidade
- Design: `./design.md`
- Migration: `financeiro.cobrancas` (RLS FORCE) + `config.integracoes` (provedor) + Vault
- Edge Functions: emitir cobrança, webhook de baixa (HMAC), poll de reconciliação (padrão Auvo)
- Porta `CobrancaGateway` (adapter por provedor) em `apps/web/src/features/financeiro/`
- Liga: recebível (E04-S04), régua de cobrança (E04-S08 pode enviar o link/PIX)
