-- ADR 0812: mediação fechada por padrão; núcleo de 0693 permanece privado.
create table pcm.sso_acesso_geracao_visita_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.sso_acesso_geracao_visita_gate enable row level security;
alter table pcm.sso_acesso_geracao_visita_gate force row level security;
revoke all on pcm.sso_acesso_geracao_visita_gate from public,anon,authenticated,service_role;
insert into pcm.sso_acesso_geracao_visita_gate(id,habilitado) values(true,false);

-- A função privada original devolve uma coluna "id"; qualificar o gate evita
-- colisão de nomes PL/pgSQL sem mudar sua ACL nem seu contrato.
create or replace function pcm.sso_listar_regras_geracao_visita(p_cliente_id uuid,p_serie_id uuid,p_apos integer default 0,p_limite integer default 20)
returns table(id uuid,numero integer,ancora_semana date,dia_semana integer,intervalo_semanas integer,hora_inicio time,fuso text,vigencia_inicio date,vigencia_fim date)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_gerar_visita_contratual_gate g where g.id),false) then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.calendario_contratual_series s where s.id=p_serie_id and s.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select r.id,r.numero,r.ancora_semana,r.dia_semana,r.intervalo_semanas,r.hora_inicio,r.fuso,r.vigencia_inicio,r.vigencia_fim from pcm.regras_visita_contratual r where r.serie_id=p_serie_id and r.numero>p_apos order by r.numero limit p_limite;
end; $$;

create function pcm.sso_pcm_listar_regras_visita(p_cliente_id uuid,p_serie_id uuid,p_apos integer default 0,p_limite integer default 20)
returns table(id uuid,numero integer,ancora_semana date,dia_semana integer,intervalo_semanas integer,hora_inicio time,fuso text,vigencia_inicio date,vigencia_fim date)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_acesso_geracao_visita_gate g where g.id),false) then raise exception 'acesso_geracao_visita_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_regras_geracao_visita(p_cliente_id,p_serie_id,p_apos,p_limite);
end; $$;

create function pcm.sso_pcm_gerar_visita(p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_id uuid,p_semana date,p_visita_id uuid,p_inicio_em timestamptz,p_responsavel_id uuid,p_cobertura text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_acesso_geracao_visita_gate where id),false) then raise exception 'acesso_geracao_visita_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return pcm.sso_gerar_visita_contratual(p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,p_visita_id,p_inicio_em,p_responsavel_id,p_cobertura);
end; $$;
revoke all on function pcm.sso_pcm_listar_regras_visita(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_pcm_listar_regras_visita(uuid,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) to authenticated;
