-- ADR-1441: OS de Chamado preventivo conserva identidade e fotografia da Rotina.
create function pcm.sso_guardar_os_chamado_preventivo() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_origens jsonb;v_origem jsonb;v_snapshot jsonb;v_itens jsonb;v_item jsonb;
 v_alvo uuid;v_tipo text;v_tipo_tarefa uuid;v_questionario uuid;
begin
 if tg_op='UPDATE' and old.chamado_id is distinct from new.chamado_id and
   (exists(select 1 from pcm.sso_chamados_ciclo_preventivo where chamado_id=old.chamado_id)
    or exists(select 1 from pcm.sso_chamados_ciclo_visita where chamado_id=old.chamado_id)) then
   raise exception 'origem_preventiva_imutavel' using errcode='23514'; end if;
 if new.chamado_id is null then return new; end if;
 select jsonb_agg(x.origem) into v_origens from (
   select jsonb_build_object('cliente',m.cliente_id,'plano',m.plano_id,'versao',o.versao_id,'rotina',o.rotina_id,
     'logica',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvo',o.alvo_id,'modo','calendario') origem
    from pcm.sso_chamados_ciclo_preventivo m join pcm.ocorrencias_rotina_preparadas o on o.id=m.preparada_id where m.chamado_id=new.chamado_id
   union all
   select jsonb_build_object('cliente',m.cliente_id,'plano',m.plano_id,'versao',o.versao_id,'rotina',o.rotina_id,
     'logica',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvo',o.alvo_id,'modo','visita')
    from pcm.sso_chamados_ciclo_visita m join pcm.ocorrencias_visita_preparadas o on o.id=m.preparada_id where m.chamado_id=new.chamado_id
 ) x;
 if v_origens is null then return new; end if;
 if jsonb_array_length(v_origens)<>1 then raise exception 'origem_preventiva_ambigua' using errcode='23514'; end if;
 if tg_op='INSERT' then
   perform 1 from pcm.sso_chamado_preventivo_gate where id and habilitado for share;
   if not found then raise exception 'origem_preventiva_desabilitada' using errcode='55000'; end if;
 end if;
 v_origem:=v_origens->0;
 if v_origem->>'cliente' is distinct from new.client_id::text or new.categoria is distinct from 'preventiva' then
   raise exception 'origem_preventiva_incompativel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id
   where v.id=(v_origem->>'versao')::uuid and v.plano_id=(v_origem->>'plano')::uuid
   and p.cliente_id=new.client_id and v.estado='aprovado' for share of v,p;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r
   where r->>'id'=v_origem->>'rotina' and r->>'rotina_logica_id'=v_origem->>'logica';
 if v_itens is null or jsonb_array_length(v_itens)<>1 then raise exception 'rotina_preventiva_ambigua' using errcode='23514'; end if;
 v_item:=v_itens->0;v_tipo:=v_origem->>'alvoTipo';v_alvo:=(v_origem->>'alvo')::uuid;
 if v_item->>'modo' is distinct from v_origem->>'modo' or v_item->>'alvo_tipo' is distinct from v_tipo
   or (case v_tipo when 'sistema' then v_item->>'sistema_id' when 'componente' then v_item->>'equipamento_id' when 'grupo' then v_item->>'grupo_id' end) is distinct from v_alvo::text then
   raise exception 'rotina_preventiva_divergente' using errcode='23514'; end if;
 if v_tipo='sistema' then
   if tg_op='INSERT' and new.sistema_id is null then new.sistema_id:=v_alvo; end if;
   if new.sistema_id is distinct from v_alvo or new.equipamento_id is not null then raise exception 'alvo_preventivo_divergente' using errcode='23514'; end if;
 elsif v_tipo='componente' then
   if tg_op='INSERT' and new.equipamento_id is null then new.equipamento_id:=v_alvo; end if;
   if new.equipamento_id is distinct from v_alvo or new.sistema_id is not null then raise exception 'alvo_preventivo_divergente' using errcode='23514'; end if;
 elsif v_tipo='grupo' then
   if new.sistema_id is not null or new.equipamento_id is not null then raise exception 'alvo_preventivo_divergente' using errcode='23514'; end if;
 else raise exception 'alvo_preventivo_invalido' using errcode='23514'; end if;
 v_tipo_tarefa:=pcm.sso_tipo_tarefa_snapshot(v_item);
 v_questionario:=nullif(v_item->>'questionario_id','')::uuid;
 if tg_op='INSERT' then
   if new.tipo_tarefa_id is null then new.tipo_tarefa_id:=v_tipo_tarefa; end if;
   if new.questionario_id is null then new.questionario_id:=v_questionario; end if;
 end if;
 if (v_tipo_tarefa is not null and new.tipo_tarefa_id is distinct from v_tipo_tarefa)
   or (v_questionario is not null and new.questionario_id is distinct from v_questionario) then
   raise exception 'conteudo_preventivo_divergente' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_os_chamado_preventivo() from public,anon,authenticated,service_role;
create trigger sso_guardar_os_chamado_preventivo before insert or update of chamado_id,client_id,sistema_id,equipamento_id,categoria,tipo_tarefa_id,questionario_id
 on pcm.ordens_servico for each row execute function pcm.sso_guardar_os_chamado_preventivo();
