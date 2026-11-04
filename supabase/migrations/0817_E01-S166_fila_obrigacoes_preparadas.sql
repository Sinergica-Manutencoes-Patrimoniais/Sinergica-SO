-- ADR-0592: consulta de obrigações preparadas; não é fila executável.
create table pcm.sso_fila_obrigacoes_preparadas_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_fila_obrigacoes_preparadas_gate enable row level security;
alter table pcm.sso_fila_obrigacoes_preparadas_gate force row level security;
revoke all on pcm.sso_fila_obrigacoes_preparadas_gate from public,anon,authenticated,service_role;
insert into pcm.sso_fila_obrigacoes_preparadas_gate(id,habilitado) values(true,false);
create function pcm.sso_listar_obrigacoes_preparadas(p_cliente_id uuid,p_plano_id uuid,p_apos_tipo text,p_apos_id uuid,p_limite integer)
returns table(tipo text,preparada_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento_original date,ocorrencia_grupo_id uuid,estado text,fila_executavel boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fila_obrigacoes_preparadas_gate where id),false) then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or ((p_apos_tipo is null) <> (p_apos_id is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query with candidatas as (
   select 'calendario'::text tipo,o.id preparada_id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,g.id grupo_id
   from pcm.ocorrencias_rotina_preparadas o left join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=o.id and g.cliente_id=p_cliente_id and g.plano_id=p_plano_id
   where o.plano_id=p_plano_id
   union all
   select 'visita'::text,o.id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,g.id
   from pcm.ocorrencias_visita_preparadas o left join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=o.id and g.cliente_id=p_cliente_id and g.plano_id=p_plano_id
   where o.plano_id=p_plano_id
 )
 select c.tipo,c.preparada_id,c.versao_id,c.rotina_id,c.alvo_tipo,c.alvo_id,c.vencimento_original,c.grupo_id,
   case when c.grupo_id is not null then 'grupo_registrado_nao_executavel' when c.alvo_tipo='grupo' then 'grupo_preparado_sem_registro' else 'preparada_sem_estado_execucao' end,false
 from candidatas c where p_apos_tipo is null or (c.tipo,c.preparada_id)>(p_apos_tipo,p_apos_id)
 order by c.tipo,c.preparada_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_obrigacoes_preparadas(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
