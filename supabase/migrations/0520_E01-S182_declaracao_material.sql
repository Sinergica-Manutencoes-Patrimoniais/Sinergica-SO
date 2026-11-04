-- ADR-0294: declaração operacional humana, sem efeito financeiro.
create table financeiro.sso_material_declaracao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_material_declaracao_gate(id,habilitado) values(true,false);
alter table financeiro.sso_material_declaracao_gate enable row level security;
alter table financeiro.sso_material_declaracao_gate force row level security;
revoke all on financeiro.sso_material_declaracao_gate from public,anon,authenticated,service_role;
create table financeiro.sso_material_declaracoes(
  id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
  lista_id uuid not null references pcm.listas_materiais(id),lista_revisao integer not null check(lista_revisao>0),
  descricao text not null check(length(btrim(descricao)) between 1 and 1000),evidencia text not null check(length(btrim(evidencia)) between 1 and 1000),
  estado text not null default 'pendente' check(estado in ('pendente','aceita','rejeitada')),revisao integer not null default 1 check(revisao>0),
  declarado_por uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  revisado_por uuid references auth.users(id),revisado_em timestamptz,motivo_revisao text,
  check((estado='pendente' and revisado_por is null and revisado_em is null and motivo_revisao is null)
    or (estado<>'pendente' and revisado_por is not null and revisado_em is not null and length(btrim(motivo_revisao)) between 1 and 1000))
);
create table financeiro.sso_material_declaracao_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),payload jsonb not null,declaracao_id uuid not null references financeiro.sso_material_declaracoes(id),criado_em timestamptz not null default now());
alter table financeiro.sso_material_declaracoes enable row level security;
alter table financeiro.sso_material_declaracoes force row level security;
alter table financeiro.sso_material_declaracao_comandos enable row level security;
alter table financeiro.sso_material_declaracao_comandos force row level security;
revoke all on financeiro.sso_material_declaracoes,financeiro.sso_material_declaracao_comandos from public,anon,authenticated,service_role;
create function financeiro.sso_declarar_material_fornecido(p_request_id uuid,p_declaracao_id uuid,p_cliente_id uuid,p_lista_id uuid,p_lista_revisao integer,p_descricao text,p_evidencia text)
returns uuid language plpgsql security definer set search_path='' as $$
declare l pcm.listas_materiais%rowtype; c financeiro.sso_material_declaracao_comandos%rowtype; payload jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_declaracao_id is null or p_cliente_id is null or p_lista_id is null or p_lista_revisao is null or p_lista_revisao<1
    or p_descricao is null or length(btrim(p_descricao)) not between 1 and 1000 or p_evidencia is null or length(btrim(p_evidencia)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  payload:=jsonb_build_object('tipo','declarar','declaracaoId',p_declaracao_id,'listaId',p_lista_id,'listaRevisao',p_lista_revisao,'descricao',btrim(p_descricao),'evidencia',btrim(p_evidencia));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('declaracao-material:'||p_request_id::text,0));
  select * into l from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for share;
  if not found or not exists(select 1 from pcm.ordens_servico o where o.id=l.ordem_servico_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  select * into c from financeiro.sso_material_declaracao_comandos where request_id=p_request_id;
  if found then
    if c.ator_id is distinct from auth.uid() or c.cliente_id<>p_cliente_id or c.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return c.declaracao_id;
  end if;
  if l.revisao<>p_lista_revisao or l.responsavel<>'sinergica' then raise exception 'lista_obsoleta_ou_responsabilidade_invalida' using errcode='40001'; end if;
  insert into financeiro.sso_material_declaracoes(id,cliente_id,os_id,lista_id,lista_revisao,descricao,evidencia,declarado_por)
    values(p_declaracao_id,p_cliente_id,l.ordem_servico_id,l.id,l.revisao,btrim(p_descricao),btrim(p_evidencia),auth.uid());
  insert into financeiro.sso_material_declaracao_comandos(request_id,ator_id,cliente_id,payload,declaracao_id) values(p_request_id,auth.uid(),p_cliente_id,payload,p_declaracao_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'material_fornecido.declarado','sso_material_declaracoes',p_declaracao_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'listaId',l.id,'osId',l.ordem_servico_id));
  return p_declaracao_id;
end $$;
revoke all on function financeiro.sso_declarar_material_fornecido(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_revisar_material_fornecido(p_request_id uuid,p_declaracao_id uuid,p_revisao integer,p_decisao text,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_material_declaracoes%rowtype; c financeiro.sso_material_declaracao_comandos%rowtype; payload jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_declaracao_id is null or p_revisao is null or p_revisao<1 or p_decisao is null or p_decisao not in ('aceita','rejeitada')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  payload:=jsonb_build_object('tipo','revisar','declaracaoId',p_declaracao_id,'revisao',p_revisao,'decisao',p_decisao,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('declaracao-material:'||p_request_id::text,0));
  select * into d from financeiro.sso_material_declaracoes where id=p_declaracao_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',d.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from financeiro.sso_material_declaracao_comandos where request_id=p_request_id;
  if found then
    if c.ator_id is distinct from auth.uid() or c.cliente_id<>d.cliente_id or c.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return c.declaracao_id;
  end if;
  if d.revisao<>p_revisao or d.estado<>'pendente' then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  update financeiro.sso_material_declaracoes set estado=p_decisao,revisao=revisao+1,revisado_por=auth.uid(),revisado_em=now(),motivo_revisao=btrim(p_motivo) where id=d.id;
  insert into financeiro.sso_material_declaracao_comandos(request_id,ator_id,cliente_id,payload,declaracao_id) values(p_request_id,auth.uid(),d.cliente_id,payload,d.id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'material_fornecido.revisado','sso_material_declaracoes',d.id,jsonb_build_object('requestId',p_request_id,'decisao',p_decisao,'revisao',d.revisao+1));
  return d.id;
end $$;
revoke all on function financeiro.sso_revisar_material_fornecido(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_listar_declaracoes_material(p_cliente_id uuid,p_apos uuid default null)
returns table(id uuid,os_id uuid,lista_id uuid,lista_revisao integer,descricao text,evidencia text,estado text,revisao integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where financeiro.sso_material_declaracao_gate.id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select d.id,d.os_id,d.lista_id,d.lista_revisao,d.descricao,d.evidencia,d.estado,d.revisao,d.criado_em
    from financeiro.sso_material_declaracoes d where d.cliente_id=p_cliente_id and (p_apos is null or d.id>p_apos) order by d.id limit 20;
end $$;
revoke all on function financeiro.sso_listar_declaracoes_material(uuid,uuid) from public,anon,authenticated,service_role;
