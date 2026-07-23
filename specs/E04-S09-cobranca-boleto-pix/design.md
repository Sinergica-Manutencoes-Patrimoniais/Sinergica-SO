---
name: design-E04-S09-cobranca-boleto-pix
description: Design — emissão de cobrança boleto/PIX via gateway de pagamento (Asaas/Cora/similar) e baixa automática do recebível por webhook.
alwaysApply: false
---

# Design — Cobrança bancária: boleto/PIX

> **Tier arquitetural.** Integração externa nova (gateway de pagamento) + webhook com HMAC. Aprovar
> antes de codar. Ver `seguranca/os-grade.md` (secrets em Vault, webhook HMAC).

## Problema
Para "usar com clientes de verdade", a Sinérgica precisa **receber**: emitir boleto/PIX de um
recebível e dar **baixa automática** quando o cliente paga. Hoje o recebível é só um lançamento
previsto com baixa manual (E04-S04). NF-e continua fora (non-goal D8); isto é **cobrança**, não nota
fiscal.

## Contexto atual (AS-IS)
- Recebível = `financeiro.lancamentos` (previsto/entrada/recorrência ou avulso), baixa manual — E04-S04.
- Padrão de integração externa do projeto: credencial em **Vault** (E00-S12 `config.integracoes` +
  RPCs), webhook com **HMAC** validado antes do parse (padrão `pcm-auvo-webhook`), Edge Functions.

## Decisões
### D1 — Gateway de pagamento, não banco direto
Integrar um **gateway** (ex.: Asaas, Cora, Gerencianet/Efí) que emite boleto + PIX por API e envia
webhook de pagamento. **Sem Open Finance** (non-goal do épico). Provider atrás de uma **porta**
(`CobrancaGateway`) para trocar sem reescrever o domínio.

**Decisão (2026-07-21, Lucas):** provedor é **Mercado Pago** — API `POST /v1/payments` com
`payment_method_id: "pix"` ou `"bolbradesco"` (boleto), webhook de notificação com header
`x-signature` (HMAC-SHA256, manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`). Resolve o
OPEN-QUESTION abaixo.

### D2 — Credencial no Vault, seleção do provedor na config
API key/token do gateway vai pro Vault (padrão E00-S12); provedor + ambiente (sandbox/prod) em
`config.integracoes`. Nunca em tabela/log.

### D3 — Emissão liga recebível ↔ cobrança externa
Emitir cria uma cobrança no gateway a partir de um recebível (`financeiro.lancamentos` previsto) e
guarda o id externo + link/linha digitável/QR PIX numa tabela `financeiro.cobrancas`.

### D4 — Baixa automática por webhook (HMAC)
Webhook do gateway (pago/cancelado/estornado) → Edge Function valida HMAC antes de qualquer parse →
dá **baixa** no recebível (marca `realizado`, cria conciliação lógica) idempotente por evento. Falha
nunca deixa o recebível em estado inconsistente.

### D5 — Idempotência e reconciliação
Todo evento de webhook é idempotente (dedupe por id do evento). Job de reconciliação (poll) cobre
webhook perdido, mesmo espírito do motor Auvo.

## Alternativas descartadas
- **Integração bancária direta/Open Finance** — non-goal do épico (D3 herdado).
- **Reconstruir emissão de boleto** — usa gateway, não CNAB cru.
- **NF-e junto** — non-goal (D8), story separada futura.

## Impacto
- Migration `financeiro.cobrancas` + `config.integracoes` (provedor de cobrança) + Vault.
- Edge Functions: emitir cobrança + webhook de baixa (HMAC) + poll de reconciliação.
- Liga na régua de cobrança (E04-S08): o lembrete pode carregar o link/PIX.

## Riscos
- Escolha de provedor muda contrato de API → porta `CobrancaGateway` isola.
- Webhook sem HMAC = fraude de baixa → validar assinatura antes do parse (obrigatório).
- Taxas do gateway → fora do escopo de cálculo aqui (é custo, entra como saída se desejado).

## OPEN-QUESTION
- ~~Qual gateway (Asaas / Cora / Efí / outro)?~~ **Resolvido: Mercado Pago** (D1).
