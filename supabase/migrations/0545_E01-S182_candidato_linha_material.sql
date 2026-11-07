-- ADR-0319: candidato pendente e exclusivo, sem cobrança nem lançamento.
create table financeiro.sso_candidato_linha_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_candidato_linha_gate(id,habilitado) values(true,false);
alter table financeiro.sso_candidato_linha_gate enable row level security;
alter table financeiro.sso_candidato_linha_gate force row level security;
revoke all on financeiro.sso_candidato_linha_gate from public,anon,authenticated,service_role;
create table financeiro.sso_candidato_linha_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,item_id uuid not null references financeiro.itens_faturaveis(id),criado_em timestamptz not null default now());
alter table financeiro.sso_candidato_linha_comandos enable row level security;
alter table financeiro.sso_candidato_linha_comandos force row level security;
revoke all on financeiro.sso_candidato_linha_comandos from public,anon,authenticated,service_role;
create function financeiro.sso_reconhecer_linha_material(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_quantidade integer,p_preco_unitario bigint,p_competencia date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v financeiro.sso_material_linha_proposta%rowtype; d financeiro.sso_material_declaracoes%rowtype; p comercial.propostas%rowtype;
  c financeiro.sso_candidato_linha_comandos%rowtype; v_payload jsonb; v_item uuid; v_linha jsonb; v_soma numeric; v_total numeric;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or p_quantidade is null or p_quantidade not between 1 and 999999
    or p_preco_unitario is null or p_preco_unitario not between 0 and 1000000000000 or p_competencia is null or not isfinite(p_competencia)
    or extract(day from p_competencia)<>1 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_candidato_linha_gate where id),false)
    or not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false)
    or not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false)
    or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  lock table financeiro.fechamentos_mensais in share mode;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'declaracaoId',p_declaracao_id,'quantidade',p_quantidade,'precoUnitario',p_preco_unitario,'competencia',p_competencia);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidato-linha:'||p_request_id::text,0));
  select * into d from financeiro.sso_material_declaracoes where id=p_declaracao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  select * into c from financeiro.sso_candidato_linha_comandos where request_id=p_request_id;
  if found then
    if c.ator_id is distinct from auth.uid() or c.cliente_id<>p_cliente_id or c.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return c.item_id;
  end if;
  select * into v from financeiro.sso_material_linha_proposta where declaracao_id=d.id;
  if not found or d.estado<>'aceita' or v.quantidade<>p_quantidade or v.preco_unitario_centavos<>p_preco_unitario then raise exception 'linha_ou_valor_divergente' using errcode='23514'; end if;
  select * into p from comercial.propostas where id=v.proposta_id and deleted_at is null for update;
  if not found or p.status<>'aceita' or p.versao_atual<>v.versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  select e into v_linha from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e
    where s.proposta_id=v.proposta_id and s.versao=v.versao and e->>'id'=v.linha_id::text;
  if not found or (v_linha->>'precoUnitarioCentavos')::numeric<>p_preco_unitario then raise exception 'linha_nao_comprovada' using errcode='23514'; end if;
  select coalesce(sum(x.quantidade),0) into v_soma from financeiro.sso_material_linha_proposta x where x.proposta_id=v.proposta_id and x.versao=v.versao and x.linha_id=v.linha_id;
  if v_soma>(v_linha->>'quantidade')::numeric then raise exception 'quantidade_excedida' using errcode='23514'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=p_competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  v_total:=p_quantidade::numeric*p_preco_unitario;
  if v_total>9007199254740991 then raise exception 'valor_invalido' using errcode='23514'; end if;
  v_item:=pg_catalog.gen_random_uuid();
  insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia)
    values(v_item,p_cliente_id,'material_proposta_linha',d.id,v_total::bigint,p_competencia);
  insert into financeiro.sso_candidato_linha_comandos(request_id,ator_id,cliente_id,payload,item_id) values(p_request_id,auth.uid(),p_cliente_id,v_payload,v_item);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.linha_reconhecida','itens_faturaveis',v_item,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'declaracaoId',d.id,'propostaId',v.proposta_id,'versao',v.versao,'linhaId',v.linha_id));
  return v_item;
end $$;
revoke all on function financeiro.sso_reconhecer_linha_material(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
