# ADR-1650 — Consulta inversa de Planos por alvo

## Estado

Proposta E01-S176; não aplicada nem homologada. Complementa ADR-0049.

## Decisão

Preparar leitura paginada por Cliente e alvo, com ator autenticado, capacidade atual de estrutura e de gestão de Plano, e gate de banco desligado. Rascunhos são consultados pela tabela de Rotinas; versões aprovadas, somente pelo snapshot imutável, como no contrato existente. Retornar cada vínculo com identificadores, estado e vigência da versão, sem inferir que uma versão esteja vigente. Ordenar por Plano, versão e Rotina com cursor composto.

## Limites e gates

O gate fica desligado e a interface também usa flag desativada. Snapshot inválido em qualquer versão aprovada do Cliente bloqueia a consulta em vez de produzir ausência enganosa. A leitura percorre snapshots do Cliente e deve ser medida antes de qualquer ativação. Páginas são solicitações independentes e não compõem retrato transacional; alterações concorrentes podem mudar a cobertura entre páginas. Trava de autorização depende da adesão dos escritores. Validar permissões, concorrência, histórico, cliente, volume, cast e RLS, e fazer revisão adversarial antes de liberar. A consulta não substitui o inventário de preventivas legadas nem prova cobertura funcional ou vigência operacional.
