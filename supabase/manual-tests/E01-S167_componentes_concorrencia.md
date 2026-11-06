# S167 — concorrência da leitura de Componentes

Somente clone descartável, em rede interna e sem `cron`/`net`. Aplicar 1055 e executar `E01-S167_componentes_corrida_setup.sql` no clone; manter a base diagnóstica principal e seu gate inalterados. A fixture usa UUIDs `16798111-*`, usuário superadmin sintético e uma concessão por Cliente.

No clone reconstruído por `pg_dump -s` condicionado, a função 1055 original devolveu o Componente enquanto outra sessão mantinha a trava exclusiva `hashtextextended('sso-autorizacao-confirmacao-visita',0)`. Com a proteção adicionada a 1055, foram observados:

- Revogação em transação aberta (`update config.sso_concessoes set ativa=false`): chamada `authenticated` devolveu `55P03 autorizacao_em_alteracao`, sem dados.
- Consulta autenticada primeiro, mantendo transação aberta: atualização de concessão em outra sessão, com `lock_timeout='1s'`, terminou em timeout na trava de autorização; fechamento do gate também terminou em timeout na linha.
- Revogação confirmada: consulta posterior recusou com `42501 chamado_nao_encontrado_ou_sem_acesso`.
- Fechamento do gate primeiro: consulta esperou o commit e então recusou com `55000 conversao_integral_mediada_bloqueada`.
- `REPEATABLE READ` foi recusado com `25001 isolamento_nao_suportado`.

Comando da chamada autenticada: definir `request.jwt.claims` com `sub=16798111-0000-4000-8000-000000000001`, `role=authenticated`, `user_role=superadmin`, executar como `authenticated` e chamar `pcm.sso_listar_componentes_conversao('16798111-0000-4000-8000-00000000000a','16798111-0000-4000-8000-000000000011',null,100)`.

O clone usado não incluiu `cron` nem `net` e sua restauração de schema parou em ACL de extensão; permissões para a RPC e `USAGE` em PCM foram concedidas explicitamente. Isso não prova integração HTTP, rollout, todas as fontes de revogação, alteração concorrente de Cliente/Chamado, snapshots entre páginas ou isolamento da tabela legada. O clone é descartável e deve ser removido ao terminar o ensaio.
