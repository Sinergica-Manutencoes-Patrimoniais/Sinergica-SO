-- ADR-0762: bloquear caminhos sem verificação para fotos da ingestão nova.
create function pcm.sso_foto_ingestao_reservada_interno(p_foto_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from pcm.sso_ingestao_foto_reservas r where r.foto_id=p_foto_id);
$$;
revoke all on function pcm.sso_foto_ingestao_reservada_interno(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_bloquear_foto_digest_vinculo_legado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_foto uuid;
begin
  if tg_table_name='sso_anexos_localizacao_atualizada' then
    if new.tipo_anexo<>'foto' then return new; end if;
    v_foto:=new.anexo_id;
  else v_foto:=new.foto_id; end if;
  if pcm.sso_foto_ingestao_reservada_interno(v_foto) then raise exception 'foto_requer_leitura_verificada' using errcode='55000'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_bloquear_foto_digest_vinculo_legado() from public,anon,authenticated,service_role;
create trigger sso_foto_digest_vinculo_legado before insert or update on pcm.sso_foto_staging_ativo for each row execute function pcm.sso_bloquear_foto_digest_vinculo_legado();
create trigger sso_foto_digest_vinculo_legado before insert or update on pcm.sso_foto_staging_grupo for each row execute function pcm.sso_bloquear_foto_digest_vinculo_legado();
create trigger sso_foto_digest_vinculo_legado before insert or update on pcm.sso_anexos_localizacao_atualizada for each row execute function pcm.sso_bloquear_foto_digest_vinculo_legado();

create or replace function pcm.sso_caminho_foto_levantamento(p_foto_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  v_nome:=pcm.sso_caminho_foto_levantamento_interno(p_foto_id);
  if exists(select 1 from pcm.sso_retiradas_anexo where tipo='foto' and anexo_id=p_foto_id) then raise exception 'anexo_indisponivel' using errcode='42501'; end if;
  if pcm.sso_foto_ingestao_reservada_interno(p_foto_id) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_foto_levantamento(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_caminho_foto_staging_ativo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;v_foto uuid;
begin
  v_nome:=pcm.sso_caminho_foto_staging_ativo_interno(p_vinculo_id);
  select x.foto_id into v_foto from pcm.sso_foto_staging_ativo x where x.id=p_vinculo_id;
  if v_foto is null or pcm.sso_foto_inadequada(v_foto) or pcm.sso_foto_ingestao_reservada_interno(v_foto) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_foto_staging_ativo(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_caminho_foto_staging_grupo(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;v_foto uuid;
begin
  v_nome:=pcm.sso_caminho_foto_staging_grupo_interno(p_vinculo_id);
  select x.foto_id into v_foto from pcm.sso_foto_staging_grupo x where x.id=p_vinculo_id;
  if v_foto is null or pcm.sso_foto_inadequada(v_foto) or pcm.sso_foto_ingestao_reservada_interno(v_foto) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_foto_staging_grupo(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_caminho_foto_equipamento_interno_v2(p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v_nome text;
begin
  if auth.uid() is null or not coalesce((select g.habilitado from pcm.sso_foto_equipamento_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select o.name into v_nome from pcm.sso_foto_staging_ativo x
  join pcm.sso_fotos_levantamento f on f.id=x.foto_id and f.cliente_id=x.cliente_id
  join pcm.equipamentos e on e.id=x.entidade_id and e.client_id=x.cliente_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null
  join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos'
  join storage.buckets b on b.id=o.bucket_id and b.public is false
  join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
  where x.id=p_vinculo_id and x.tipo='equipamento' and not pcm.sso_foto_inadequada(f.id)
    and not pcm.sso_foto_ingestao_reservada_interno(f.id)
    and not exists(select 1 from pcm.sso_retiradas_anexo r where r.tipo='foto' and r.anexo_id=f.id)
    and (config.sso_autorizar_acao('cadastro.ler',x.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',x.cliente_id) is true);
  if v_nome is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_foto_equipamento_interno_v2(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_caminho_anexo_localizacao_atualizada(p_tipo text,p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v pcm.sso_anexos_localizacao_atualizada%rowtype;v_nome text;v_decisao text;
begin
 if not coalesce((select habilitado from pcm.sso_acesso_anexo_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_localizacao_atualizada_gate where id),false) then raise exception 'acesso_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_vinculo_id is null or p_tipo is null or p_tipo not in ('foto','documento') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v from pcm.sso_anexos_localizacao_atualizada where id=p_vinculo_id and tipo_anexo=p_tipo;
 if not found or (config.sso_autorizar_acao('cadastro.ler',v.cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',v.cliente_id) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not ((v.tipo_localizacao='area' and exists(select 1 from pcm.areas a where a.id=v.entidade_id and a.cliente_id=v.cliente_id and a.ativo and a.deleted_at is null)) or (v.tipo_localizacao in ('local','sublocal') and exists(select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=v.entidade_id and a.cliente_id=v.cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null))) or exists(select 1 from pcm.sso_retiradas_anexo r where r.tipo=p_tipo and r.anexo_id=v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='foto' then
   select d.decisao into v_decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=v.anexo_id order by d.revisao desc limit 1;
   if v_decisao is distinct from 'aceita' or pcm.sso_foto_inadequada(v.anexo_id) or pcm.sso_foto_ingestao_reservada_interno(v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
   select o.name into v_nome from pcm.sso_fotos_levantamento f join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos' and split_part(o.name,'/',1)=v.cliente_id::text and split_part(o.name,'/',2)=v.lote_id::text join storage.buckets b on b.id=o.bucket_id and b.public is false where f.id=v.anexo_id and f.cliente_id=v.cliente_id and f.lote_id=v.lote_id and f.linha_chave=v.linha_chave;
 else
   select d.decisao into v_decisao from pcm.sso_decisoes_documento_levantamento d where d.documento_id=v.anexo_id order by d.revisao desc limit 1;
   if v_decisao is distinct from 'aceito' or pcm.sso_documento_inadequado(v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
   select o.name into v_nome from pcm.sso_documentos_levantamento d join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos' and split_part(o.name,'/',1)=v.cliente_id::text and split_part(o.name,'/',2)=v.lote_id::text join storage.buckets b on b.id=o.bucket_id and b.public is false where d.id=v.anexo_id and d.cliente_id=v.cliente_id and d.lote_id=v.lote_id and d.linha_chave=v.linha_chave;
 end if;
 if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_anexo_localizacao_atualizada(text,uuid) from public,anon,authenticated,service_role;
