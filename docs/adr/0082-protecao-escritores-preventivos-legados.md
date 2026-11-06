---
name: "docs-adr-0082-protecao-escritores-preventivos-legados-md"
description: "Documento Sinérgica SO: ADR-0082 — Proteção faseada dos resultados preventivos legados"
alwaysApply: false
---

# ADR-0082 — Proteção faseada dos resultados preventivos legados

## Decisão

Enquanto as rotas e importadores existentes tratam apenas Preventivas legadas, proteger no banco gravações de avaliações e de resultado consolidado contra Ocorrências de outra origem. Triggers verificam origem no servidor também para `service_role`; avaliação bloqueia a linha de Ocorrência enquanto verifica para evitar corrida com mudança de origem. Ocorrência ausente continua sujeita à foreign key existente. Lotes mistos são rejeitados integralmente pela transação.

Isto não habilita uma origem nova nem define o caminho de avaliação dela. Antes de habilitá-la será necessária evolução explícita dos triggers e de suas APIs, autorização por Cliente e testes de concorrência. A proteção não cobre todos os efeitos privilegiados externos, reservas de envio ou gravação de achados; Edge Functions e webhooks ainda precisam de adaptação própria. A atualização antiga que não altera resultado não sofre bloqueio deste trigger.

## Compatibilidade e reversão

Aplicar após 0304; verificar custo de locks, concorrência e comportamento de importação em lote no ambiente alvo. Recuo só é seguro enquanto a constraint de fase bloqueia origem nova; não apagar avaliações ou resultados. Não autoriza deploy nem testes Auvo reais.
