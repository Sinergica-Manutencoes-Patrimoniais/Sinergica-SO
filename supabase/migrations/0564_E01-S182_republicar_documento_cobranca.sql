-- ADR-0338: novo vínculo após retirada, com histórico e idempotência.
alter table financeiro.sso_documentos_cobranca add column ativo boolean not null default true;
alter table financeiro.sso_documentos_cobranca drop constraint sso_doc_cobranca_par_uq;
create unique index sso_documentos_cobranca_ativo on financeiro.sso_documentos_cobranca(publicacao_cobranca_id,publicacao_anexo_id) where ativo;
create or replace function financeiro.sso_vincular_documento_cobranca(p_cobranca_id uuid,p_anexo_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$ begin raise exception 'comando_substituido' using errcode='55000'; end $$;
revoke all on function financeiro.sso_vincular_documento_cobranca(uuid,uuid) from public,anon,authenticated,service_role;
create table financeiro.sso_documento_cobranca_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),cobranca_id uuid not null references financeiro.sso_portal_cobranca_publicacoes(id),
  anexo_id uuid not null references pcm.sso_portal_anexos_publicacoes(id),vinculo_id uuid not null references financeiro.sso_documentos_cobranca(id),criado_em timestamptz not null default now());
alter table financeiro.sso_documento_cobranca_comandos enable row level security;
alter table financeiro.sso_documento_cobranca_comandos force row level security;
revoke all on financeiro.sso_documento_cobranca_comandos from public,anon,authenticated,service_role;
create function financeiro.sso_publicar_documento_cobranca_v2(p_request_id uuid,p_cobranca_id uuid,p_anexo_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c financeiro.sso_portal_cobranca_publicacoes%rowtype; a pcm.sso_portal_anexos_publicacoes%rowtype;
  anterior financeiro.sso_documento_cobranca_comandos%rowtype; v_id uuid;
begin
  if auth.uid() is null or p_request_id is null or p_cobranca_id is null or p_anexo_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from financeiro.sso_documento_cobranca_gate where id),false)
    or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-cobranca-request:'||p_request_id::text,0));
  select * into c from financeiro.sso_portal_cobranca_publicacoes where id=p_cobranca_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',c.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_documento_cobranca_comandos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>c.cliente_id or anterior.cobranca_id<>p_cobranca_id or anterior.anexo_id<>p_anexo_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.vinculo_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('documento-cobranca-par:'||p_cobranca_id::text||':'||p_anexo_id::text,0));
  select * into a from pcm.sso_portal_anexos_publicacoes where id=p_anexo_id and cliente_id=c.cliente_id and ordem_servico_id=c.os_id for share;
  if not found or exists(select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id=a.id)
    or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.id=a.objeto_id and o.bucket_id='os-anexos' and o.name=a.caminho and o.metadata is not distinct from a.metadata_snapshot and o.updated_at is not distinct from a.objeto_updated_at)
    then raise exception 'anexo_nao_publicado_ou_indisponivel' using errcode='23514'; end if;
  if not exists(select 1 from financeiro.lancamentos l where l.id=c.lancamento_id and l.cliente_id=c.cliente_id and l.os_id=c.os_id and l.tipo='entrada'
    and l.valor_centavos=c.valor_centavos and l.data_competencia=c.competencia and l.data_vencimento is not distinct from c.vencimento)
    or exists(select 1 from financeiro.sso_portal_cobranca_publicacoes nova where nova.lancamento_id=c.lancamento_id and (nova.criado_em,nova.id)>(c.criado_em,c.id)) then raise exception 'cobranca_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from financeiro.sso_documentos_cobranca v where v.publicacao_cobranca_id=c.id and v.publicacao_anexo_id=a.id and v.ativo) then raise exception 'vinculo_ativo_existente' using errcode='23505'; end if;
  insert into financeiro.sso_documentos_cobranca(publicacao_cobranca_id,publicacao_anexo_id,ator_id) values(c.id,a.id,auth.uid()) returning id into v_id;
  insert into financeiro.sso_documento_cobranca_comandos(request_id,ator_id,cliente_id,cobranca_id,anexo_id,vinculo_id) values(p_request_id,auth.uid(),c.cliente_id,c.id,a.id,v_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'cobranca.documento_publicado','lancamentos',c.lancamento_id,jsonb_build_object('requestId',p_request_id,'vinculoId',v_id,'publicacaoCobrancaId',c.id,'publicacaoAnexoId',a.id));
  return v_id;
end $$;
revoke all on function financeiro.sso_publicar_documento_cobranca_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Atualização após criar as dependências; preserva assinaturas e concessões.
create or replace function financeiro.sso_retira_documento_cobranca(p_vinculo_id uuid,p_motivo text)
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
  update financeiro.sso_documentos_cobranca set ativo=false where id=v.id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'cobranca.documento_retirado','lancamentos',c.lancamento_id,
    jsonb_build_object('vinculoId',v.id,'clienteId',c.cliente_id,'motivo',btrim(p_motivo)));
end $$;
