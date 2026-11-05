-- ADR-1435: referência histórica explícita, sem inferir tipo em snapshots antigos.
create function pcm.sso_tipo_tarefa_snapshot(p_item jsonb) returns uuid language plpgsql immutable set search_path='' as $$
declare v text:=p_item->>'tipo_tarefa_id';
begin
 if v is null then return null; end if;
 if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'tipo_tarefa_historico_invalido' using errcode='23514'; end if;
 return v::uuid;
end; $$;
revoke all on function pcm.sso_tipo_tarefa_snapshot(jsonb) from public,anon,authenticated,service_role;

create function pcm.sso_copiar_tipo_tarefa_revisao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb;v_encontradas jsonb;v_item jsonb;v_tipo uuid;
begin
 if new.tipo_tarefa_id is not null then return new; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v where v.plano_id=new.plano_id and v.estado='aprovado' order by v.numero desc limit 1 for share;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then return new; end if;
 select jsonb_agg(r) into v_encontradas from jsonb_array_elements(v_snapshot->'rotinas') r where r->>'rotina_logica_id'=new.rotina_logica_id::text;
 if v_encontradas is null then return new; end if;
 if jsonb_array_length(v_encontradas)<>1 then raise exception 'origem_tipo_tarefa_ambigua' using errcode='23514'; end if;
 v_item:=v_encontradas->0;v_tipo:=pcm.sso_tipo_tarefa_snapshot(v_item);
 if v_tipo is null then return new; end if;
 if v_item->>'alvo_tipo' is distinct from new.alvo_tipo or v_item->>'sistema_id' is distinct from new.sistema_id::text
   or v_item->>'equipamento_id' is distinct from new.equipamento_id::text or v_item->>'grupo_id' is distinct from new.grupo_id::text then return new; end if;
 perform 1 from pcm.sso_referencia_tarefa_legada_gate where id and habilitado for share;
 if not found then raise exception 'preservacao_tipo_tarefa_desabilitada' using errcode='55000'; end if;
 new.tipo_tarefa_id:=v_tipo;return new;
end; $$;
revoke all on function pcm.sso_copiar_tipo_tarefa_revisao() from public,anon,authenticated,service_role;
create trigger sso_copiar_tipo_tarefa_revisao before insert on pcm.rotinas_manutencao for each row execute function pcm.sso_copiar_tipo_tarefa_revisao();

create function pcm.sso_copiar_tipo_tarefa_plano() returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_snapshot jsonb;v_mapa jsonb;v_item jsonb;v_origens jsonb;v_origem jsonb;v_tipo uuid;v_destino uuid;
begin
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=new.cliente_id
  where v.id=new.origem_versao_id and v.plano_id=new.origem_plano_id and v.estado='aprovado' for share of v,p;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' or encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex') is distinct from new.snapshot_sha256 then raise exception 'snapshot_tipo_tarefa_indisponivel' using errcode='23514'; end if;
 v_mapa:=new.resultado->'rotinas';
 if jsonb_typeof(v_mapa) is distinct from 'array' or jsonb_array_length(v_mapa)<>jsonb_array_length(v_snapshot->'rotinas') then raise exception 'mapa_tipo_tarefa_invalido' using errcode='23514'; end if;
 for v_item in select value from jsonb_array_elements(v_mapa) loop
  select jsonb_agg(r) into v_origens from jsonb_array_elements(v_snapshot->'rotinas') r where r->>'id'=v_item->>'origemRotinaId';
  if v_origens is null or jsonb_array_length(v_origens)<>1 then raise exception 'origem_tipo_tarefa_ambigua' using errcode='23514'; end if;
  v_origem:=v_origens->0;v_tipo:=pcm.sso_tipo_tarefa_snapshot(v_origem);if v_tipo is null then continue; end if;
  perform 1 from pcm.sso_referencia_tarefa_legada_gate where id and habilitado for share;
  if not found then raise exception 'preservacao_tipo_tarefa_desabilitada' using errcode='55000'; end if;
  v_destino:=(v_item->>'rotinaId')::uuid;
  update pcm.rotinas_manutencao r set tipo_tarefa_id=v_tipo where r.id=v_destino and r.plano_id=new.destino_plano_id and r.versao_id=new.destino_versao_id
   and r.alvo_tipo=v_origem->>'alvo_tipo' and r.sistema_id::text is not distinct from v_origem->>'sistema_id'
   and r.equipamento_id::text is not distinct from v_origem->>'equipamento_id' and r.grupo_id::text is not distinct from v_origem->>'grupo_id' and r.tipo_tarefa_id is null;
  if not found then raise exception 'destino_tipo_tarefa_divergente' using errcode='23514'; end if;
 end loop;return new;
end; $$;
revoke all on function pcm.sso_copiar_tipo_tarefa_plano() from public,anon,authenticated,service_role;
create trigger sso_copiar_tipo_tarefa_plano after insert on pcm.sso_copias_plano for each row execute function pcm.sso_copiar_tipo_tarefa_plano();

create function pcm.sso_copiar_tipo_tarefa_modelo() returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_snapshot jsonb;v_itens jsonb;v_item jsonb;v_tipo uuid;v_alvo text;
begin
 if new.origem_cliente_id is distinct from new.destino_cliente_id then return new; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=new.origem_cliente_id
  where v.id=new.origem_versao_id and v.plano_id=new.origem_plano_id and v.estado='aprovado' for share of v,p;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_tipo_tarefa_indisponivel' using errcode='23514'; end if;
 select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r where r->>'id'=new.origem_rotina_id::text;
 if v_itens is null or jsonb_array_length(v_itens)<>1 then raise exception 'origem_tipo_tarefa_ambigua' using errcode='23514'; end if;
 v_item:=v_itens->0;
 if encode(sha256(convert_to(v_item::text,'UTF8')),'hex') is distinct from new.snapshot_sha256 then raise exception 'snapshot_tipo_tarefa_divergente' using errcode='23514'; end if;
 v_tipo:=pcm.sso_tipo_tarefa_snapshot(v_item);if v_tipo is null then return new;end if;
 v_alvo:=case v_item->>'alvo_tipo' when 'sistema' then v_item->>'sistema_id' when 'componente' then v_item->>'equipamento_id' when 'grupo' then v_item->>'grupo_id' end;
 if v_alvo is null then raise exception 'alvo_historico_invalido' using errcode='23514'; end if;
 if new.payload->>'alvoTipo' is distinct from v_item->>'alvo_tipo' or new.payload->>'alvoId' is distinct from v_alvo then return new; end if;
 perform 1 from pcm.sso_referencia_tarefa_legada_gate where id and habilitado for share;
 if not found then raise exception 'preservacao_tipo_tarefa_desabilitada' using errcode='55000'; end if;
 update pcm.rotinas_manutencao r set tipo_tarefa_id=v_tipo from pcm.plano_versoes v,pcm.planos_manutencao p
  where r.id=new.destino_rotina_id and r.plano_id=new.destino_plano_id and p.id=r.plano_id and p.cliente_id=new.destino_cliente_id and p.estado='rascunho'
   and v.id=r.versao_id and v.plano_id=p.id and v.estado='rascunho' and r.alvo_tipo=v_item->>'alvo_tipo'
   and coalesce(r.sistema_id,r.equipamento_id,r.grupo_id)::text=v_alvo and r.tipo_tarefa_id is null;
 if not found then raise exception 'destino_tipo_tarefa_divergente' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_copiar_tipo_tarefa_modelo() from public,anon,authenticated,service_role;
create trigger sso_copiar_tipo_tarefa_modelo after insert on pcm.sso_copias_rotina_modelo for each row execute function pcm.sso_copiar_tipo_tarefa_modelo();
