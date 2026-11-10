---
name: "docs-adr-0362-confirmacao-cliente-visita-md"
description: "Documento Sinérgica SO: ADR-0362 — Confirmação explícita do Cliente na Visita"
alwaysApply: false
---

# ADR-0362 — Confirmação explícita do Cliente na Visita

Status: proposta; sem ativação, testes ou envio ao Auvo.

A ciência informativa do Portal não satisfaz confirmação obrigatória. Quando a política efetiva e o snapshot da confirmação PCM coincidirem em modo obrigatório, um contato ativo pode confirmar explicitamente a versão da visita comunicada; a confirmação é registrada separadamente, com contato, data e vínculo à confirmação PCM. A ação não confirma a Visita pelo PCM nem libera ou envia tarefas. Mudança de versão, política, retirada da publicação ou vínculo impede uma nova confirmação; retry é idempotente. O envio permanece bloqueado até integrar e testar validação transacional da política efetiva e dessa evidência (incluindo canais externos já registrados pelo PCM) e revisar permissões. Nada presume que ciência informativa seja confirmação.
