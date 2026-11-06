-- ADR-0297: vínculo preliminar, sem candidato nem inferência de valor unitário.
create table financeiro.sso_material_proposta_vinculos(
  declaracao_id uuid primary key references financeiro.sso_material_declaracoes(id),cliente_id uuid not null references pcm.clientes(id),
  proposta_id uuid not null references comercial.propostas(id),versao integer not null check(versao>0),
  ator_id uuid not null references auth.users(id),request_id uuid not null unique,motivo text not null check(length(btrim(motivo)) between 1 and 1000),criado_em timestamptz not null default now()
);
alter table financeiro.sso_material_proposta_vinculos enable row level security;
alter table financeiro.sso_material_proposta_vinculos force row level security;
revoke all on financeiro.sso_material_proposta_vinculos from public,anon,authenticated,service_role;
create function financeiro.sso_vincular_material_proposta(p_request_id uuid,p_declaracao_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_material_declaracoes%rowtype; p comercial.propostas%rowtype; anterior financeiro.sso_material_proposta_vinculos%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_declaracao_id is null or p_cliente_id is null or p_proposta_id is null or p_versao is null or p_versao<1
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-material:'||p_request_id::text,0));
  select * into d from financeiro.sso_material_declaracoes where id=p_declaracao_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_material_proposta_vinculos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.declaracao_id<>p_declaracao_id or anterior.proposta_id<>p_proposta_id
      or anterior.versao<>p_versao or anterior.motivo<>btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.declaracao_id;
  end if;
  select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for share;
  if not found or d.estado<>'aceita' or p.status<>'aceita' or p.versao_atual<>p_versao
    or not exists(select 1 from comercial.proposta_origens_operacionais origem join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=origem.ordem_servico_id
      join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
      where origem.proposta_id=p_proposta_id and l.id=d.lista_id and os.id=d.os_id)
    or not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p_proposta_id::text and c.payload->>'versao'=p_versao::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita')
    or not exists(select 1 from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p_proposta_id and pub.versao=p_versao)
    then raise exception 'origem_ou_versao_nao_comprovada' using errcode='23514'; end if;
  insert into financeiro.sso_material_proposta_vinculos(declaracao_id,cliente_id,proposta_id,versao,ator_id,request_id,motivo)
    values(d.id,p_cliente_id,p_proposta_id,p_versao,auth.uid(),p_request_id,btrim(p_motivo));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'material_fornecido.vinculo_preliminar','sso_material_declaracoes',d.id,
    jsonb_build_object('requestId',p_request_id,'propostaId',p_proposta_id,'versao',p_versao,'clienteId',p_cliente_id));
  return d.id;
end $$;
revoke all on function financeiro.sso_vincular_material_proposta(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
