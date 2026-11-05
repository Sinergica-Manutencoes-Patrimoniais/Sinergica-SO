-- Clone descartável, BEGIN/ROLLBACK. Trigger 1045 real; gate dedicado ativado apenas na transação.
-- Não prova segurança integral nem autoriza homologação.
begin;
\ir manual_E01-S165_nova_data_futura_1702.sql
reset role;
-- A base mantém fim sintético fechado; abrir apenas neste clone para exercitar a revisão.
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_fim=null where id='16630000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.aprovacao_revisao_gate set habilitado=true where id;
update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado) values ('16630000-1111-4000-8000-000000000704','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,'UTC','fixture','fixture','16630000-1111-4000-8000-000000000001','{}','{}');
set local role authenticated;
select pcm.sso_classificar_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000705','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000043',3,0,'nao_relacionado','documento','obrigação distinta',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20)));
reset role;
-- Ativa somente no clone o gate dedicado; 1045 não é simulada.
update pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id;

-- Gate da 1804 desligado: preparação não autoriza.
set local role authenticated;
do $$ begin
  begin
    perform pcm.sso_preparar_aprovacao_versao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
    raise exception 'gate_nao_bloqueou';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update pcm.sso_aprovacao_versao_esperada_gate set habilitado=true where id;
set local role authenticated;
do $$ declare foto jsonb; a jsonb; b jsonb; begin
  foto:=pcm.sso_preparar_aprovacao_versao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
  if foto->>'versaoId'<>'16630000-1111-4000-8000-000000000022' then raise exception 'versao_incorreta'; end if;
  begin
    perform pcm.sso_aprovar_versao_esperada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date+1,true);
    raise exception 'versao_divergente_aceita';
  exception when sqlstate 'P0011' then null; end;
  begin
    perform pcm.sso_preparar_aprovacao_versao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000099','16630000-1111-4000-8000-000000000011',3);
    raise exception 'cliente_divergente_aceito';
  exception when insufficient_privilege then null; end;
  a:=pcm.sso_aprovar_versao_esperada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_date+1,true);
  b:=pcm.sso_aprovar_versao_esperada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_date+1,true);
  if a is distinct from b or a->'linkedIds'->>'versaoId'<>'16630000-1111-4000-8000-000000000022' then raise exception 'replay_divergente'; end if;
  b:=pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1);
  if a is distinct from b then raise exception 'replay_legado_divergente'; end if;
end $$;
reset role;
rollback;
