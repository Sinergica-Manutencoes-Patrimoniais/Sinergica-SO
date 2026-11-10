-- ADR-1436: novas OS vinculadas respeitam o tipo explícito da fotografia aprovada.
create function pcm.sso_guardar_tipo_tarefa_os_preventiva()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_oc pcm.ocorrencias_rotina_preparadas%rowtype;
 v_cliente uuid; v_snapshot jsonb; v_itens jsonb; v_item jsonb; v_tipo uuid; v_alvo text;
begin
 if new.ocorrencia_preventiva_id is null then return new; end if;
 select o.* into v_oc from pcm.ocorrencias_rotina_vinculos ponte
   join pcm.ocorrencias_rotina_preparadas o on o.id=ponte.ocorrencia_preparada_id
   where ponte.ocorrencia_legada_id=new.ocorrencia_preventiva_id;
 if not found then return new; end if;
 select p.cliente_id,v.snapshot into v_cliente,v_snapshot
   from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id
   where p.id=v_oc.plano_id and v.id=v_oc.versao_id and v.estado='aprovado';
 if not found or v_cliente is distinct from new.client_id or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then
   raise exception 'origem_preventiva_indisponivel' using errcode='23514';
 end if;
 select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r
   where r->>'id'=v_oc.rotina_id::text;
 if v_itens is null or jsonb_array_length(v_itens)<>1 then
   raise exception 'rotina_preventiva_ambigua' using errcode='23514';
 end if;
 v_item:=v_itens->0;
 v_alvo:=case v_item->>'alvo_tipo' when 'sistema' then v_item->>'sistema_id'
   when 'componente' then v_item->>'equipamento_id' when 'grupo' then v_item->>'grupo_id' end;
 if v_item->>'rotina_logica_id' is distinct from v_oc.rotina_logica_id::text
   or v_item->>'alvo_tipo' is distinct from v_oc.alvo_tipo or v_alvo is distinct from v_oc.alvo_id::text then
   raise exception 'origem_preventiva_divergente' using errcode='23514';
 end if;
 v_tipo:=pcm.sso_tipo_tarefa_snapshot(v_item);
 if v_tipo is not null and new.tipo_tarefa_id is distinct from v_tipo then
   raise exception 'tipo_tarefa_preventiva_divergente' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_tipo_tarefa_os_preventiva() from public,anon,authenticated,service_role;
create trigger sso_guardar_tipo_tarefa_os_preventiva before insert on pcm.ordens_servico
 for each row execute function pcm.sso_guardar_tipo_tarefa_os_preventiva();
