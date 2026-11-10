-- ADR-0337: revogação aditiva e irreversível do vínculo de cobrança.
create table financeiro.sso_documentos_cobranca_revogacoes(
  vinculo_id uuid primary key references financeiro.sso_documentos_cobranca(id),
  motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table financeiro.sso_documentos_cobranca_revogacoes enable row level security;
alter table financeiro.sso_documentos_cobranca_revogacoes force row level security;
revoke all on financeiro.sso_documentos_cobranca_revogacoes from public,anon,authenticated,service_role;
create function financeiro.sso_retira_documento_cobranca(p_vinculo_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v financeiro.sso_documentos_cobranca%rowtype; c financeiro.sso_portal_cobranca_publicacoes%rowtype;
begin
  if auth.uid() is null or p_vinculo_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into v from financeiro.sso_documentos_cobranca where id=p_vinculo_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from financeiro.sso_portal_cobranca_publicacoes where id=v.publicacao_cobranca_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',c.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-cobranca-par:'||v.publicacao_cobranca_id::text||':'||v.publicacao_anexo_id::text,0));
  perform 1 from financeiro.sso_documentos_cobranca where id=v.id for update;
  if exists(select 1 from financeiro.sso_documentos_cobranca_revogacoes r where r.vinculo_id=v.id) then return; end if;
  insert into financeiro.sso_documentos_cobranca_revogacoes(vinculo_id,motivo,ator_id) values(v.id,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'cobranca.documento_retirado','lancamentos',c.lancamento_id,
    jsonb_build_object('vinculoId',v.id,'clienteId',c.cliente_id,'motivo',btrim(p_motivo)));
end $$;
revoke all on function financeiro.sso_retira_documento_cobranca(uuid,text) from public,anon,authenticated,service_role;
create function financeiro.sso_historico_documentos_cobranca(p_cliente_id uuid,p_lancamento_id uuid,p_apos uuid default null)
returns table(vinculo_id uuid,titulo text,criado_em timestamptz,retirado_em timestamptz,motivo text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.lancamentos l where l.id=p_lancamento_id and l.cliente_id=p_cliente_id)
    or not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select v.id,a.titulo,v.criado_em,r.criado_em,r.motivo from financeiro.sso_documentos_cobranca v
    join financeiro.sso_portal_cobranca_publicacoes c on c.id=v.publicacao_cobranca_id and c.cliente_id=p_cliente_id and c.lancamento_id=p_lancamento_id
    join pcm.sso_portal_anexos_publicacoes a on a.id=v.publicacao_anexo_id and a.cliente_id=c.cliente_id and a.ordem_servico_id=c.os_id
    left join financeiro.sso_documentos_cobranca_revogacoes r on r.vinculo_id=v.id
    where p_apos is null or v.id>p_apos order by v.id limit 20;
end $$;
revoke all on function financeiro.sso_historico_documentos_cobranca(uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Atualização após criar as dependências; preserva assinaturas e concessões.
create or replace function financeiro.sso_vincular_documento_cobranca(p_cobranca_id uuid,p_anexo_id uuid)
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
  if v_id is null then select v.id into v_id from financeiro.sso_documentos_cobranca v where v.publicacao_cobranca_id=c.id and v.publicacao_anexo_id=a.id
    and not exists(select 1 from financeiro.sso_documentos_cobranca_revogacoes r where r.vinculo_id=v.id);
    if v_id is null then raise exception 'vinculo_retirado' using errcode='23514'; end if;
  else insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'cobranca.documento_publicado','lancamentos',c.lancamento_id,jsonb_build_object('vinculoId',v_id,'publicacaoCobrancaId',c.id,'publicacaoAnexoId',a.id)); end if;
  return v_id;
end $$;

create or replace function financeiro.sso_portal_documentos_cobranca(p_cliente_id uuid,p_os_id uuid,p_lancamento_id uuid,p_apos uuid default null)
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
      and not exists(select 1 from financeiro.sso_documentos_cobranca_revogacoes r where r.vinculo_id=v.id)
      and (p_apos is null or v.id>p_apos) order by v.id limit 20;
end $$;
