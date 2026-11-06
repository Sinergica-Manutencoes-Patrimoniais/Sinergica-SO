# ADR-0771: serializar autorização da finalização

Status: proposta implementada, dependente de revisão adversarial e homologação. Gates permanecem fechados.

## Contexto

A revogação de `execucao.validar` pode confirmar depois da última checagem e antes do commit da finalização. A prova em duas sessões está em `supabase/tests/manual_s168_gate_concorrencia_resultado.md`. A trava dos gates não protege fontes de permissão.

## Decisão

Reusar opt-in a trava compartilhada transacional da migração 0319, antes de consultar autorização e antes das travas dos gates. Alterações das dez fontes usadas por `config.sso_autorizar_acao` e `config.resolver_permissoes_modulo` obtêm a mesma trava exclusiva por triggers statement-level, inclusive INSERT e TRUNCATE: `config.usuarios`, `config.sso_acoes`, `pcm.clientes`, `config.sso_acao_modulos`, `config.sso_concessoes`, `config.sso_usuario_perfis`, `config.sso_perfis`, `config.usuario_modulos`, `config.grupos`, `config.grupo_modulos`. Confirmar novamente a abrangência ao alterar os resolvedores ou triggers.

A tentativa compartilhada é não bloqueante: alteração em andamento resulta em `autorizacao_em_alteracao` (55P03). Se a operação obtiver a trava primeiro, a revogação espera seu commit; se a revogação confirmar antes, a operação reavalia o estado corrente. Exigir READ COMMITTED evita snapshot persistente anterior à aquisição. Falhas exigem nova tentativa explícita, sem presumir sucesso. A trava não resolve concorrência de conteúdo do retorno ou snapshot técnico.

## Consequências

Compartilhar o protocolo com confirmação de Visita amplia contenção de alterações de autorização; transações longas segurando a trava atrasam tais alterações. Evitar locks bloqueantes para limitar deadlocks. A migração preserva interface e privilégios anteriores e não abre gates. Revisão de isolamento, contenção, migrações, segurança e testes integrados ainda é obrigatória antes de homologar.
