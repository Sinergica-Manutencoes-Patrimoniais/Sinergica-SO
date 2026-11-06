-- ADR-0300: snapshot aditivo e publicação atômica; não liberar antes da integração completa.
create table comercial.sso_itens_publicos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_itens_publicos_gate(id,habilitado) values(true,false);
alter table comercial.sso_itens_publicos_gate enable row level security;
alter table comercial.sso_itens_publicos_gate force row level security;
revoke all on comercial.sso_itens_publicos_gate from public,anon,authenticated,service_role;
create table comercial.sso_itens_publicos_proposta(
  proposta_id uuid not null,versao integer not null,itens jsonb not null,request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  primary key(proposta_id,versao), foreign key(proposta_id,versao) references comercial.sso_orcamento_publicacoes(proposta_id,versao)
);
alter table comercial.sso_itens_publicos_proposta enable row level security;
alter table comercial.sso_itens_publicos_proposta force row level security;
revoke all on comercial.sso_itens_publicos_proposta from public,anon,authenticated,service_role;
create function comercial.sso_itens_publicos_imutaveis() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'snapshot_imutavel' using errcode='23514'; end $$;
revoke all on function comercial.sso_itens_publicos_imutaveis() from public,anon,authenticated,service_role;
create trigger itens_publicos_imutaveis before update or delete on comercial.sso_itens_publicos_proposta for each row execute function comercial.sso_itens_publicos_imutaveis();
create function comercial.sso_publicar_orcamento_itens(p_request_id uuid,p_proposta_id uuid,p_versao integer,p_escopo text,p_descricao text,p_itens jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p comercial.propostas%rowtype; existente comercial.sso_itens_publicos_proposta%rowtype; resultado jsonb; total numeric; quantidade integer; distintos integer;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao<1
    or p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens) not between 1 and 100 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) e where jsonb_typeof(e)<>'object'
    or not (e ?& array['id','descricao','quantidade','precoUnitarioCentavos']) or (e-'id'-'descricao'-'quantidade'-'precoUnitarioCentavos')<>'{}'::jsonb
    or jsonb_typeof(e->'id')<>'string' or (e->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(e->'descricao')<>'string' or length(btrim(e->>'descricao')) not between 1 and 1000
    or jsonb_typeof(e->'quantidade')<>'number' or (e->>'quantidade') !~ '^[1-9][0-9]{0,5}$'
    or jsonb_typeof(e->'precoUnitarioCentavos')<>'number' or (e->>'precoUnitarioCentavos') !~ '^(0|[1-9][0-9]{0,12})$')
    then raise exception 'itens_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publicar-itens:'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:'||p_request_id::text,0));
  select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found or not comercial.sso_orcamento_operacional_autorizado(p_proposta_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into existente from comercial.sso_itens_publicos_proposta where request_id=p_request_id;
  if found then
    if existente.proposta_id<>p_proposta_id or existente.versao<>p_versao or existente.ator_id is distinct from auth.uid() or existente.itens is distinct from p_itens then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return comercial.sso_transicionar_orcamento_sem_oportunidade(p_request_id,p_proposta_id,p_versao,'aprovada','publicar',p_escopo,p_descricao);
  end if;
  if p.status<>'aprovada' or p.versao_atual<>p_versao then raise exception 'versao_obsoleta' using errcode='40001'; end if;
  select count(*),count(distinct e->>'id'),sum((e->>'quantidade')::numeric*(e->>'precoUnitarioCentavos')::numeric)
    into quantidade,distintos,total from jsonb_array_elements(p_itens) e;
  if quantidade<>distintos or total<>p.preco_centavos then raise exception 'itens_ou_total_divergentes' using errcode='23514'; end if;
  resultado:=comercial.sso_transicionar_orcamento_sem_oportunidade(p_request_id,p_proposta_id,p_versao,'aprovada','publicar',p_escopo,p_descricao);
  insert into comercial.sso_itens_publicos_proposta(proposta_id,versao,itens,request_id,ator_id) values(p_proposta_id,p_versao,p_itens,p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento_operacional.itens_publicados','propostas',p_proposta_id,jsonb_build_object('requestId',p_request_id,'versao',p_versao,'quantidade',quantidade));
  return resultado;
end $$;
revoke all on function comercial.sso_publicar_orcamento_itens(uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated,service_role;
