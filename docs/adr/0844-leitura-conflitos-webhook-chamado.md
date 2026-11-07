---
name: "docs-adr-0844-leitura-conflitos-webhook-chamado-md"
description: "Documento Sinérgica SO: ADR-0844 — Leitura de conflitos do webhook na reconciliação"
alwaysApply: false
---

# ADR-0844 — Leitura de conflitos do webhook na reconciliação

Estado: proposta local; gates fechados, não homologada. Complementa ADR-0842.

O indicador de conflito na lista não mostra qual status foi rejeitado nem quando ocorreu. Criar leitura paginada por Cliente e OS, sujeita ao gate existente de reconciliação e à capacidade `integracao.reconciliar`, retornando apenas identificador interno do conflito, task, status remoto, datas e condição aberta/resolvida. Não retornar payload do webhook nem informações de outro Cliente. Sem acesso direto à tabela ou concessão de EXECUTE à RPC nesta etapa; a futura liberação depende de rollout coordenado.

A tela de OS na reconciliação pode consultar e apresentar esse histórico por opção visual desligada por padrão. A nota existente continua disponível; consultar ou anotar não resolve o conflito, não altera OS e não aciona Auvo.

Sem identificador confiável de evento, uma nova entrega de OS/task/status após uma resolução poderia ser retry antigo ou novo evento. Portanto esta decisão não implementa nem infere resolução automática. Comando de resolução exige política de evidência, histórico, autorização e comportamento para esse caso; CI, concorrência, segurança e revisão adversarial permanecem pendentes. Rollback é desabilitar a opção visual e manter a RPC privada; dados não são apagados.
