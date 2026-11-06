-- Somente cluster descartável com fixtures sintéticas. O chamador deve iniciar
-- transação, aplicar 0315 e 0320 e finalizar com ROLLBACK. Não usar em produção.
insert into config.usuarios(user_id) values ('17800000-0000-0000-0000-000000000001');
insert into pcm.clientes(id) values ('17800000-0000-0000-0000-00000000000a');
select set_config('test.actor', '17800000-0000-0000-0000-000000000001', true);
select set_config('test.allow', 'yes', true);
do $$
declare
  v_primeiro jsonb;
  v_retorno jsonb;
  v_lote pcm.sso_levantamentos%rowtype;
  v_linhas jsonb := '[{"chave":"a","tipo":"area","atributos":{"nome":"Sintético"}}]'::jsonb;
begin
  if has_function_privilege('authenticated', 'pcm.sso_receber_levantamento(uuid,uuid,text,text,jsonb)', 'execute') then
    raise exception 'RPC antiga exposta';
  end if;
  if has_function_privilege('anon', 'pcm.sso_receber_levantamento_manual(uuid,uuid,text,text,jsonb)', 'execute') then
    raise exception 'RPC manual exposta a anônimo';
  end if;
  v_primeiro := pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','auvo','chave-sintetica',v_linhas);
  select * into strict v_lote from pcm.sso_levantamentos where id = (v_primeiro->>'aggregateId')::uuid;
  if v_lote.origem <> 'manual' or v_lote.meio_recepcao <> 'manual' or v_lote.origem_declarada <> 'auvo' then
    raise exception 'declaração confundida com origem comprovada';
  end if;
  v_retorno := pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','auvo','chave-sintetica',v_linhas);
  if v_retorno is distinct from v_primeiro then raise exception 'replay não idempotente'; end if;
  begin
    perform pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','campo','chave-sintetica',v_linhas);
    raise exception 'replay divergente aceito';
  exception when unique_violation then null; end;
  begin
    perform pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000102','17800000-0000-0000-0000-00000000000a','verificado','outra',v_linhas);
    raise exception 'origem verificada falsificada';
  exception when invalid_parameter_value then null; end;
  perform set_config('test.allow','no',true);
  begin
    perform pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','auvo','chave-sintetica',v_linhas);
    raise exception 'replay aceito após revogação';
  exception when insufficient_privilege then null; end;
end $$;
