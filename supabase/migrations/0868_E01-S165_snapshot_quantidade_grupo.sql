-- ADR-0643: somente novas aprovações, opcional quando não há alvo Grupo.
create table pcm.sso_snapshot_quantidade_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_snapshot_quantidade_grupo_gate enable row level security;
alter table pcm.sso_snapshot_quantidade_grupo_gate force row level security;
revoke all on pcm.sso_snapshot_quantidade_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_snapshot_quantidade_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_congelar_quantidades_grupo() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;v_rotina jsonb;v_grupo pcm.grupos_quantitativos%rowtype;v_saida jsonb:='[]'::jsonb;
begin
 if old.estado<>'rascunho' or new.estado<>'aprovado' or not coalesce((select habilitado from pcm.sso_snapshot_quantidade_grupo_gate where id),false) then return new; end if;
 if jsonb_typeof(new.snapshot) is distinct from 'object' or jsonb_typeof(new.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_invalido' using errcode='23514'; end if;
 select cliente_id into v_cliente from pcm.planos_manutencao where id=new.plano_id;
 if v_cliente is null then raise exception 'plano_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(new.snapshot->'rotinas') x(item) where item->>'alvo_tipo'='grupo' and (nullif(item->>'id','') is null or nullif(item->>'grupo_id','') is null)) or exists(select 1 from jsonb_array_elements(new.snapshot->'rotinas') x(item) where item->>'alvo_tipo'='grupo' group by item->>'id' having count(*)>1) then raise exception 'identidade_grupo_invalida' using errcode='23514'; end if;
 for v_rotina in select item from jsonb_array_elements(new.snapshot->'rotinas') x(item) where item->>'alvo_tipo'='grupo' order by item->>'grupo_id',item->>'id' loop
   select * into v_grupo from pcm.grupos_quantitativos where id=(v_rotina->>'grupo_id')::uuid and cliente_id=v_cliente and ativo and deleted_at is null for share;
   if not found then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
   v_saida:=v_saida||jsonb_build_array(jsonb_build_object('rotinaId',v_rotina->>'id','grupoId',v_grupo.id,'quantidade',v_grupo.quantidade::text,'revisao',v_grupo.revisao,'vigenciaInicio',new.vigencia_inicio));
 end loop;
 new.snapshot:=jsonb_set(new.snapshot,'{quantidades_grupo}',v_saida,true);
 return new;
end; $$;
revoke all on function pcm.sso_congelar_quantidades_grupo() from public,anon,authenticated,service_role;
create trigger sso_congelar_quantidades_grupo before update of estado on pcm.plano_versoes for each row execute function pcm.sso_congelar_quantidades_grupo();
