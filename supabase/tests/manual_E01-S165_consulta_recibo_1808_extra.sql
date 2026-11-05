-- Continuação da fixture 1807, dentro da mesma transação sintética revertida.
-- A borda 1808 consulta histórico e nunca chama o comando de criação.
set local role authenticated;
do $$
declare r jsonb; antes integer; depois integer;
begin
 r:=pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='contratos') then raise exception 'consulta_recibo_divergente';end if;
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000099','contratos');
  raise exception 'payload_divergente_aceito';
 exception when unique_violation then null;end;
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','evidencias');
  raise exception 'modo_divergente_aceito';
 exception when unique_violation then null;end;
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000099','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null;end;
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-000000000099','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
  raise exception 'cliente_divergente_aceito';
 exception when insufficient_privilege then null;end;
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18080000-0000-4000-8000-000000000001',4,'18080001-0000-4000-8000-000000000001','evidencias');
  raise exception 'recibo_ausente_aceito';
 exception when no_data_found then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pcm.sso_revisoes_plano_contratos where request_id='18080000-0000-4000-8000-000000000001')
  or exists(select 1 from pcm.sso_revisoes_plano_evidencias where request_id='18080000-0000-4000-8000-000000000001')
  or exists(select 1 from pcm.sso_revisoes_plano_exigencias where request_id='18080000-0000-4000-8000-000000000001')
  or exists(select 1 from pcm.plano_versoes where id='18080001-0000-4000-8000-000000000001') then
  raise exception 'consulta_criou_operacao';end if;
 if has_function_privilege('anon','pcm.sso_consultar_recibo_revisao_contratos(uuid,uuid,uuid,uuid,integer,uuid,text)','EXECUTE') then
  raise exception 'consulta_acl_anon_divergente';end if;
end $$;
update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=false where id;
set local role authenticated;
do $$ begin
 begin
  perform pcm.sso_consultar_recibo_revisao_contratos('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
  raise exception 'gate_nao_bloqueou';
 exception when object_not_in_prerequisite_state then
  if sqlerrm <> 'operacao_desabilitada' then raise;end if;
 end;
end $$;
reset role;
