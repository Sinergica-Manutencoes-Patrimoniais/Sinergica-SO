---
name: "docs-adr-0926-serializar-gates-selecao-emissao-md"
description: "Documento Sinérgica SO: ADR-0926 — Serializar gates de seleção e emissão"
alwaysApply: false
---

# ADR-0926 — Serializar gates de seleção e emissão

## Contexto

Seleção e emissão liam seus gates sem bloquear alterações. Em fixture descartável, uma emissão parcial aguardou depois da leitura, o gate foi fechado e a operação retornou o documento mesmo depois do fechamento confirmado. O teste não estabelece o comportamento de outras RPCs.

## Decisão

As três RPCs de seleção e emissão adquirem lock compartilhado da linha singleton do gate de seleção antes de conferi-lo. Emissões adquirem também o gate de documento, sempre nessa ordem, antes de conferir ambos. O lock dura até o fim da transação: fechamento que começa primeiro é observado; operação que começa primeiro termina antes de um fechamento concorrente. Ausência da linha continua negando a operação. Preservar autorização serializada, idempotência, assinatura e privilégios existentes, inclusive ADR-0925.

Não altera gates nem dados. Não cobre leituras, liberações ou conversões por outras RPCs, nem escrita privilegiada que desabilite triggers ou contorne locks; não é liberação de rollout. Revisar ordem global de locks, timeout, RLS, possíveis contenções e todas as RPCs antes de homologar.

## Compatibilidade e reversão

Migration aditiva após 1090; clientes precisam tolerar espera ou falha por timeout ao fechar gates. Reversão apenas por nova migration revisada e com gates mantidos fechados, pois a versão anterior permite a corrida. Sem deploy ou alteração de banco oficial.
