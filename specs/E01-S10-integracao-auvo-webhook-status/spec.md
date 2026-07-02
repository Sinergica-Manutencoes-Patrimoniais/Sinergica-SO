---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Integração Auvo: Webhook de Status e Conclusão de OS

> **Fonte da verdade.** Status: aprovado (estudo/planejamento — ver `docs/STATE.md`)
> Tier: Pequeno (reaproveita a fundação/ACL já desenhada em `E01-S09` — não introduz domínio novo,
> só um novo endpoint de entrada). Sem `design.md` próprio; consome o design de `E01-S09`.

## Resumo
O PCM passa a receber, via webhook, as mudanças de status da task no Auvo (execução, conclusão)
e atualiza a OS correspondente automaticamente, incluindo o gatilho para o registro PMOC quando
a OS é uma preventiva de climatização.

## Critérios de aceite

### AC-1: Webhook autentica a assinatura antes de processar
- **Dado** uma requisição recebida em `pcm-auvo-webhook` com header `X-Auvo-Signature:
  t=<ts>,v1=<hex>`
- **Quando** a Edge Function processa a requisição
- **Então** ela recalcula o HMAC-SHA256 do corpo com o secret do webhook (Vault) e só continua
  se bater com `v1`; caso contrário responde `401` sem processar nada (código já esboçado no
  mapeamento, seção 13.2, a reutilizar).

### AC-2: Evento de Task "Alteração" com status Concluída atualiza a OS para `finalizado`
- **Dado** uma OS com `auvo_task_id` preenchido e `status = 'em_execucao'`
- **Quando** chega um webhook `entity=Task (4), action=Alteração (2)` com o status da task Auvo
  igual a "Concluída"
- **Então** a OS correspondente (encontrada por `auvo_task_id`) muda para `status = 'finalizado'`.

### AC-3: Evento de Task "Alteração" com status "Em execução" atualiza a OS para `em_execucao`
- **Dado** uma OS com `auvo_task_id` preenchido e `status = 'planejamento'`
- **Quando** chega um webhook de Task com status Auvo "Em execução" (técnico fez check-in)
- **Então** a OS muda para `status = 'em_execucao'`.

### AC-4: Evento de Task "Alteração" com status "Cancelada" atualiza a OS para `cancelado`
- **Dado** uma OS com `auvo_task_id` preenchido
- **Quando** chega um webhook de Task com status Auvo "Cancelada"
- **Então** a OS muda para `status = 'cancelado'`.

### AC-5: Webhook duplicado (reentrega) não aplica a transição duas vezes
- **Dado** um webhook já processado com sucesso para uma dada task+status
- **Quando** o mesmo evento é reentregue pelo Auvo (retry de rede, comportamento comum de
  webhook)
- **Então** a segunda entrega é um no-op idempotente — nenhuma transição de estado inválida é
  tentada (ex.: `finalizado → finalizado` não gera erro, só confirma).

### AC-6: Webhook para `auvo_task_id` desconhecido não derruba o endpoint
- **Dado** um webhook chega referenciando um `taskId` que não corresponde a nenhuma
  `pcm.ordens_servico.auvo_task_id` conhecida
- **Quando** a Edge Function processa
- **Então** responde `200` (confirma recebimento ao Auvo, evita retry infinito) e loga um aviso
  — não lança exceção 500.

### AC-7: OS preventiva de climatização concluída dispara criação de registro PMOC
- **Dado** uma OS com `categoria = 'preventiva'` vinculada a um equipamento de climatização
  (inventário PMOC)
- **Quando** o webhook de conclusão (AC-2) é processado
- **Então** um registro em `pcm.pmoc_records` é criado a partir dos dados retornados pela task
  (checklist, fotos, assinatura) — comportamento já previsto em
  `docs/blueprint/01-pcm-operacao.md` ("Criado via webhook do Auvo quando a OS é fechada").

## Casos de borda e erros
- Webhook chega antes do registro do webhook estar ativo no Auvo (`GET /webhooks` mostra
  `active: false`): fora de controle do PCM, não é caso de teste — é pré-condição de
  configuração (checklist de ativação, mapeamento seção 14).
- Corpo do webhook malformado (não é JSON válido): responde `400`, loga o corpo bruto para
  diagnóstico (nunca deve acontecer em produção, mas não pode derrubar a função).
- Task Auvo referenciando um `customerId` sem `pcm.clientes.auvo_id` correspondente: não deveria
  acontecer (toda task nasce a partir de uma OS que já tinha o cliente sincronizado — `E01-S09`
  AC-4), mas se acontecer, loga como inconsistência e não tenta criar cliente a partir do
  webhook (webhook é read-only para o PCM, nunca escreve em `pcm.clientes`).

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Criação da task no Auvo (feito por `E01-S09`) — este story só consome eventos.
- Registro dos eventos `entity=Customer`/`entity=User`/`entity=Equipment` — só `entity=Task` é
  consumido aqui; sync de técnicos/equipamentos é `E01-S11` (via API, não via webhook).
- Fotos/checklist/assinatura completos anexados ao PDF do Laudo de Visita — esse story só cria o
  registro `pcm.pmoc_records`; a geração do PDF é escopo de PMOC (`E01-S05`, já planejado no
  ROADMAP).
- Reconciliação de fallback (polling) se o webhook nunca chegar — risco já documentado em
  `docs/blueprint/integracoes/auvo.md` → "Riscos conhecidos", sem story aberta ainda.

## Rastreabilidade
- Design técnico: `../E01-S09-integracao-auvo-fundacao/design.md` (cliente HTTP, ACL, eventos de
  domínio — reaproveitados aqui)
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`
- Blueprint de origem: `docs/blueprint/integracoes/auvo.md` (Edge Function `pcm-auvo-webhook`,
  mapeamento de status), `docs/blueprint/01-pcm-operacao.md` (gatilho de `pcm.pmoc_records`)
- Mapeamento de API consultado: `Auvo-API-Mapeamento-Completo.md` §2.29 (WebHooks), §13.2 (Fluxo
  Conclusão→Fechamento, com exemplo de validação de assinatura TS), §3.6/3.7 (enums de entidade
  e ação de webhook)
