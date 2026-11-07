-- S165 AC-7: a reserva integrada serializa o gerador legado com a suspensão SSO.
-- Verificação estrutural do contrato pgTAP; não executa o materializador nem cria Auvo.
begin;
select plan(4);
select ok(pg_catalog.pg_get_functiondef('pcm.sso_indice_legado_reservado_sso(uuid,integer)'::regprocedure) like
  '%r.decisao=''integrar_ponte'' and p.estado not in (''aprovado'',''ativo'')%',
  'ciclo integrado recusa geração quando Plano SSO está suspenso ou encerrado');
select ok(pg_catalog.pg_get_functiondef('pcm.sso_indice_legado_reservado_sso(uuid,integer)'::regprocedure) like
  '%from pcm.planos_manutencao where id=r.plano_id for share nowait%',
  'a checagem do estado mantém lock compartilhado contra corrida com transição');
select ok(pg_catalog.pg_get_functiondef('pcm.materializar_ocorrencias_preventivas(uuid,date)'::regprocedure) like
  '%sso_indice_legado_reservado_sso(p_plano_id,v_indice)%',
  'gerador legado consulta reserva para cada índice antes de inserir');
select ok(pg_catalog.pg_get_functiondef('pcm.sso_indice_legado_reservado_sso(uuid,integer)'::regprocedure) like
  '%if r.decisao=''somente_sso'' then return true%',
  'decisão somente SSO continua impedindo duplicação legada');
select * from finish();
rollback;
