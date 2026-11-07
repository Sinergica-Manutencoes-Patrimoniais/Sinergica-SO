create table pcm.sso_historico_remocao_caracteristica_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_remocao_caracteristica_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_remocao_caracteristica_gate enable row level security;alter table pcm.sso_historico_remocao_caracteristica_gate force row level security;
revoke all on pcm.sso_historico_remocao_caracteristica_gate from public,anon,authenticated,service_role;
create function pcm.sso_historico_remocao_caracteristica(p_cliente_id uuid,p_grupo_id uuid,p_apos integer,p_limite integer)
returns table(request_id uuid,revisao_anterior integer,revisao_nova integer,chave text,motivo text,antes jsonb,depois jsonb,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_historico_remocao_caracteristica_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_grupo_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if (config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true) or not exists(select 1 from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.cliente_id=p_cliente_id and g.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select r.request_id,r.revisao_anterior,r.revisao_nova,r.chave,r.motivo,r.antes,r.depois,r.ator_id,r.criado_em from pcm.sso_remocoes_caracteristica_grupo r where r.cliente_id=p_cliente_id and r.grupo_id=p_grupo_id and (p_apos is null or r.revisao_nova>p_apos) order by r.revisao_nova limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_remocao_caracteristica(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
