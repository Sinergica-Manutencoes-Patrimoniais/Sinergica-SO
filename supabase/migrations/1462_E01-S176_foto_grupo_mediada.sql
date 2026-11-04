-- ADR-1315: autorização booleana para usuário e localização somente para serviço.
create table pcm.sso_foto_grupo_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_foto_grupo_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_foto_grupo_mediada_gate enable row level security;
alter table pcm.sso_foto_grupo_mediada_gate force row level security;
revoke all on pcm.sso_foto_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_autorizar_foto_grupo_mediada(p_ator_id uuid,p_vinculo_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_vinculo_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_grupo_mediada_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_staging_grupo_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 perform pcm.sso_caminho_foto_staging_grupo(p_vinculo_id);
 return true;
end; $$;
revoke all on function pcm.sso_autorizar_foto_grupo_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_autorizar_foto_grupo_mediada(uuid,uuid) to authenticated;

create function pcm.sso_localizar_foto_grupo_servico(p_vinculo_id uuid)
returns table(caminho text,objeto_id uuid,foto_id uuid,objeto_atualizado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if p_vinculo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_foto_grupo_mediada_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_staging_grupo_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 return query select o.name,o.id,f.id,o.updated_at from pcm.sso_foto_staging_grupo x
   join pcm.grupos_quantitativos g on g.id=x.grupo_id and g.cliente_id=x.cliente_id and g.ativo and g.deleted_at is null
   join pcm.sso_fotos_levantamento f on f.id=x.foto_id and f.cliente_id=x.cliente_id
   join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos'
   join storage.buckets b on b.id=o.bucket_id and b.public is false
   join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
   where x.id=p_vinculo_id and not pcm.sso_foto_inadequada(f.id) and not pcm.sso_foto_ingestao_reservada_interno(f.id);
end; $$;
revoke all on function pcm.sso_localizar_foto_grupo_servico(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_localizar_foto_grupo_servico(uuid) to service_role;
