-- ADR-1379: gate fechado preserva o comportamento existente.
create table pcm.sso_mudanca_dia_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mudanca_dia_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_mudanca_dia_grupo_gate enable row level security;
alter table pcm.sso_mudanca_dia_grupo_gate force row level security;
revoke all on pcm.sso_mudanca_dia_grupo_gate from public,anon,authenticated,service_role;

create function pcm.sso_grupo_visita_sem_efeitos(p_cliente_id uuid,p_preparada_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare g pcm.sso_ocorrencias_grupo%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_mudanca_dia_grupo_gate where id),false) then return false; end if;
 select * into g from pcm.sso_ocorrencias_grupo where visita_preparada_id=p_preparada_id and cliente_id=p_cliente_id;
 if not found or not exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.id=p_preparada_id and o.plano_id=g.plano_id
   and o.versao_id=g.versao_id and o.rotina_id=g.rotina_id and o.alvo_tipo='grupo' and o.alvo_id=g.grupo_id and o.vencimento_original=g.vencimento_original)
 then return false; end if;
 if exists(select 1 from pcm.sso_vinculos_os_grupo x where x.ocorrencia_grupo_id=g.id)
   or exists(select 1 from pcm.sso_intencoes_os_grupo x where x.ocorrencia_grupo_id=g.id)
   or exists(select 1 from pcm.sso_atestados_declarados_grupo x where x.ocorrencia_id=g.id)
   or exists(select 1 from pcm.sso_fotos_atestado_grupo x where x.ocorrencia_id=g.id)
   or exists(select 1 from pcm.sso_decisoes_foto_grupo x where x.ocorrencia_id=g.id)
   or exists(select 1 from pcm.sso_quantidades_declaradas_grupo x where x.ocorrencia_id=g.id)
   or exists(select 1 from pcm.sso_pendencias_tecnicas x where x.ocorrencia_grupo_id=g.id) then return false; end if;
 return true;
end; $$;
revoke all on function pcm.sso_grupo_visita_sem_efeitos(uuid,uuid) from public,anon,authenticated,service_role;

-- Substituição exata: recusa uma definição instalada diferente da revisada.
do $migracao$
declare v_funcao regprocedure:='pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb)'::regprocedure;
 v_definicao text:=pg_catalog.pg_get_functiondef(v_funcao);
 v_marcador text:=$antes$ for v_linha in
   select v.*,o.semana_origem$antes$;
 v_trava text:=$depois$ perform 1 from pcm.sso_mudanca_dia_grupo_gate where id and habilitado for share;
 if found then
   lock table pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_intencoes_os_grupo,
     pcm.sso_atestados_declarados_grupo,pcm.sso_fotos_atestado_grupo,pcm.sso_decisoes_foto_grupo,
     pcm.sso_quantidades_declaradas_grupo,pcm.sso_pendencias_tecnicas in share mode nowait;
 end if;
 for v_linha in
   select v.*,o.semana_origem$depois$;
 v_condicao text:=$antes$or exists(select 1 from pcm.sso_ocorrencias_grupo g where g.visita_preparada_id=o.id)$antes$;
 v_nova text:=$depois$or exists(select 1 from pcm.sso_ocorrencias_grupo g where g.visita_preparada_id=o.id
         and (v_cancelar or not pcm.sso_grupo_visita_sem_efeitos(p_cliente_id,o.id)))$depois$;
begin
 if (length(v_definicao)-length(replace(v_definicao,v_marcador,'')))/length(v_marcador)<>1
   or (length(v_definicao)-length(replace(v_definicao,v_condicao,'')))/length(v_condicao)<>1 then
   raise exception 'definicao_mudanca_dia_inesperada' using errcode='55000'; end if;
 execute replace(replace(v_definicao,v_marcador,v_trava),v_condicao,v_nova);
end; $migracao$;
