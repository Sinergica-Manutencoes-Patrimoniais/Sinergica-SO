-- ADR-0333: vínculo explícito somente a anexo previamente publicado para a mesma OS.
create table financeiro.sso_documento_cobranca_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_documento_cobranca_gate(id,habilitado) values(true,false);
alter table financeiro.sso_documento_cobranca_gate enable row level security;
alter table financeiro.sso_documento_cobranca_gate force row level security;
revoke all on financeiro.sso_documento_cobranca_gate from public,anon,authenticated,service_role;
create table financeiro.sso_documentos_cobranca(id uuid primary key default gen_random_uuid(),publicacao_cobranca_id uuid not null references financeiro.sso_portal_cobranca_publicacoes(id),
  publicacao_anexo_id uuid not null references pcm.sso_portal_anexos_publicacoes(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  constraint sso_doc_cobranca_par_uq unique(publicacao_cobranca_id,publicacao_anexo_id));
alter table financeiro.sso_documentos_cobranca enable row level security;
alter table financeiro.sso_documentos_cobranca force row level security;
revoke all on financeiro.sso_documentos_cobranca from public,anon,authenticated,service_role;
create function financeiro.sso_vincular_documento_cobranca(p_cobranca_id uuid,p_anexo_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c financeiro.sso_portal_cobranca_publicacoes%rowtype; a pcm.sso_portal_anexos_publicacoes%rowtype; v_id uuid;
begin
  if auth.uid() is null or p_cobranca_id is null or p_anexo_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where id),false)
    or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into c from financeiro.sso_portal_cobranca_publicacoes where id=p_cobranca_id for share;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',c.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into a from pcm.sso_portal_anexos_publicacoes where id=p_anexo_id and cliente_id=c.cliente_id and ordem_servico_id=c.os_id for share;
  if not found or exists(select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id=a.id)
    or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.id=a.objeto_id and o.bucket_id='os-anexos' and o.name=a.caminho and o.metadata is not distinct from a.metadata_snapshot and o.updated_at is not distinct from a.objeto_updated_at)
    then raise exception 'anexo_nao_publicado_ou_indisponivel' using errcode='23514'; end if;
  if not exists(select 1 from financeiro.lancamentos l where l.id=c.lancamento_id and l.cliente_id=c.cliente_id and l.os_id=c.os_id and l.tipo='entrada'
    and l.valor_centavos=c.valor_centavos and l.data_competencia=c.competencia and l.data_vencimento is not distinct from c.vencimento)
    or exists(select 1 from financeiro.sso_portal_cobranca_publicacoes nova where nova.lancamento_id=c.lancamento_id and (nova.criado_em,nova.id)>(c.criado_em,c.id)) then raise exception 'cobranca_obsoleta' using errcode='40001'; end if;
  insert into financeiro.sso_documentos_cobranca(publicacao_cobranca_id,publicacao_anexo_id,ator_id) values(c.id,a.id,auth.uid())
    on conflict(publicacao_cobranca_id,publicacao_anexo_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from financeiro.sso_documentos_cobranca where publicacao_cobranca_id=c.id and publicacao_anexo_id=a.id;
  else insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'cobranca.documento_publicado','lancamentos',c.lancamento_id,jsonb_build_object('vinculoId',v_id,'publicacaoCobrancaId',c.id,'publicacaoAnexoId',a.id)); end if;
  return v_id;
end $$;
revoke all on function financeiro.sso_vincular_documento_cobranca(uuid,uuid) from public,anon,authenticated,service_role;
create function financeiro.sso_portal_documentos_cobranca(p_cliente_id uuid,p_os_id uuid,p_lancamento_id uuid,p_apos uuid default null)
returns table(id uuid,publicacao_anexo_id uuid,titulo text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where financeiro.sso_documento_cobranca_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select v.id,a.id,a.titulo from financeiro.sso_documentos_cobranca v
    join financeiro.sso_portal_cobranca_publicacoes c on c.id=v.publicacao_cobranca_id and c.cliente_id=p_cliente_id and c.os_id=p_os_id and c.lancamento_id=p_lancamento_id
    join financeiro.lancamentos l on l.id=c.lancamento_id and l.cliente_id=c.cliente_id and l.os_id=c.os_id and l.tipo='entrada' and l.valor_centavos=c.valor_centavos and l.data_competencia=c.competencia and l.data_vencimento is not distinct from c.vencimento
    join pcm.sso_portal_anexos_publicacoes a on a.id=v.publicacao_anexo_id and a.cliente_id=c.cliente_id and a.ordem_servico_id=c.os_id
    where not exists(select 1 from financeiro.sso_portal_cobranca_publicacoes nova where nova.lancamento_id=c.lancamento_id and (nova.criado_em,nova.id)>(c.criado_em,c.id))
      and not exists(select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id=a.id)
      and (p_apos is null or v.id>p_apos) order by v.id limit 20;
end $$;
revoke all on function financeiro.sso_portal_documentos_cobranca(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function financeiro.sso_anexos_publicados_para_cobranca(p_cliente_id uuid,p_lancamento_id uuid,p_apos uuid default null)
returns table(cobranca_id uuid,anexo_id uuid,titulo text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where id),false)
    or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,a.id,a.titulo from financeiro.lancamentos l
    join lateral(select p.* from financeiro.sso_portal_cobranca_publicacoes p where p.lancamento_id=l.id order by p.criado_em desc,p.id desc limit 1) c on true
    join pcm.sso_portal_anexos_publicacoes a on a.cliente_id=c.cliente_id and a.ordem_servico_id=c.os_id
    where l.id=p_lancamento_id and l.cliente_id=p_cliente_id and l.tipo='entrada' and c.cliente_id=p_cliente_id and c.os_id=l.os_id
      and c.valor_centavos=l.valor_centavos and c.competencia=l.data_competencia and c.vencimento is not distinct from l.data_vencimento
      and not exists(select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id=a.id)
      and (p_apos is null or a.id>p_apos) order by a.id limit 20;
end $$;
revoke all on function financeiro.sso_anexos_publicados_para_cobranca(uuid,uuid,uuid) from public,anon,authenticated,service_role;
