-- ADR-0282: uma origem por Rotina; não cria dados operacionais.
create table pcm.sso_consulta_uniforme_ciclos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_consulta_uniforme_ciclos_gate enable row level security;
alter table pcm.sso_consulta_uniforme_ciclos_gate force row level security;
revoke all on pcm.sso_consulta_uniforme_ciclos_gate from public,anon,authenticated,service_role;
insert into pcm.sso_consulta_uniforme_ciclos_gate(id,habilitado) values(true,false);

create function pcm.sso_consultar_ciclos_uniformes(p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_serie_id uuid,p_inicio date,p_fim date,p_apos text,p_limite integer)
returns table(origem text,chave text,vencimento date,tolerancia_antes integer,tolerancia_depois integer,semana_origem date,estado_visita text,feriado text,vigencia_declarada boolean,ocorrencia_preparada boolean,fonte_incompleta boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_versao pcm.plano_versoes%rowtype;v_modo text;v_count integer;v_ciclo integer;v_visita uuid;
begin
 if not coalesce((select habilitado from pcm.sso_consulta_uniforme_ciclos_gate where id),false) then raise exception 'consulta_uniforme_bloqueada' using errcode='55000'; end if;
 if p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366 or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 select cliente_id into v_cliente from pcm.planos_manutencao where id=p_plano_id;
 if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item->>'modo') into v_count,v_modo from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where x.item->>'id'=p_rotina_id::text;
 if v_count<>1 or v_modo is null or v_modo not in ('calendario','visita') then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 if v_modo='calendario' then
  if p_serie_id is not null then raise exception 'serie_nao_aplicavel' using errcode='22023'; end if;
  if p_apos is not null then begin v_ciclo:=p_apos::integer; exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'cursor_invalido' using errcode='22023'; end; if v_ciclo<0 then raise exception 'cursor_invalido' using errcode='22023'; end if; end if;
  return query select 'calendario'::text,c.ciclo::text,c.vencimento,c.tolerancia_antes,c.tolerancia_depois,null::date,null::text,'indeterminado'::text,null::boolean,null::boolean,true
   from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim) c where v_ciclo is null or c.ciclo>v_ciclo order by c.ciclo limit p_limite;
 else
  if p_serie_id is null then raise exception 'serie_obrigatoria' using errcode='22023'; end if;
  if p_apos is not null then begin v_visita:=p_apos::uuid; exception when invalid_text_representation then raise exception 'cursor_invalido' using errcode='22023'; end; end if;
  return query select 'visita'::text,v.visita_id::text,v.vencimento_original,null::integer,null::integer,v.semana_origem,v.estado_visita,
   case when v.feriado_declarado then 'declarado'::text else 'indeterminado'::text end,v.vigencia_declarada,v.ocorrencia_preparada,true
   from pcm.sso_prever_visitas_rotina(p_plano_id,p_versao_id,p_rotina_id,p_serie_id,p_inicio,p_fim,v_visita,p_limite) v;
 end if;
end; $$;
revoke all on function pcm.sso_consultar_ciclos_uniformes(uuid,uuid,uuid,uuid,date,date,text,integer) from public,anon,authenticated,service_role;
