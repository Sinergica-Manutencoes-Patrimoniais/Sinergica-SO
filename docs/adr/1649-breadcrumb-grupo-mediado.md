# ADR-1649 — Leitura mediada do breadcrumb de Grupo

## Estado

Proposta E01-S176; não aplicada nem homologada. Complementa ADR-0285.

## Decisão

Expor apenas mediador autenticado da consulta privada existente. O comando confere ator da sessão, Cliente esperado, Grupo ativo, capacidade atual e gate fechado; preserva a checagem de hierarquia do comando original. Adquire trava compartilhada do protocolo de autorização e trava de leitura no Grupo, e retorna o Cliente no envelope para conferência da interface. A interface valida sessão antes e após a consulta e identifica o contexto nas chaves de cache.

## Limites e gates

Gate original permanece desligado. Não ativa leitura nem prova isolamento contra todas as alterações concorrentes dos ancestrais: a consulta original percorre a hierarquia e não bloqueia cada Local/Área. A trava de autorização depende da adesão de todos os escritores relevantes. Executar testes de permissão, revogação, mudança de Cliente, movimentação e ciclos, mais revisão adversarial, antes de habilitar; não declarar AC-5 concluído com esta preparação.
