# ADR-1652 — Detalhe mínimo do ativo no Local

## Estado

Proposta E01-S176; não aplicada ou homologada.

## Decisão

Preparar consulta mínima do ativo e histórico de OS por Cliente com funções SECURITY INVOKER, preservando grants e RLS das tabelas existentes. Além da RLS, exigir ator atual e capacidade `cadastro.ler` ou `cadastro.gerir` no Cliente. Histórico combina apenas OS visíveis pela RLS e do mesmo Cliente, com vínculo direto ou Auvo; informa as fontes e usa cursor por UUID. Gate privado permanece desligado. Sem criar capacidade nova ou substituir o drawer legado.

## Limites

O catálogo não contém capacidade específica para leitura de OS; a consulta não concede acesso além da RLS efetiva. Cliente-síndico não tem acesso por `sso_autorizar_acao`. As consultas usam trava compartilhada do protocolo 0319 antes de conferir autorização e gate, em READ COMMITTED; sua eficácia depende de todos os escritores de autorização aderirem ao protocolo. O helper de gate não bloqueia mudanças concorrentes do próprio gate. A trava não protege movimentação de ativos ou integridade do mapeamento Auvo. A ausência de resultados não comprova ausência de OS invisíveis ou sem vínculo. Páginas não formam snapshot. Antes de habilitar, revisar políticas de RLS/grants e concorrência, além de testar permitido/negado e dois Clientes; fazer revisão adversarial.
