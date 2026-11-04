-- ADR-0599: escopo comum de proposta; gate fechado preserva caminho legado.
create table financeiro.sso_coordenacao_linhas_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_coordenacao_linhas_gate(id,habilitado) values(true,false);
alter table financeiro.sso_coordenacao_linhas_gate enable row level security;
alter table financeiro.sso_coordenacao_linhas_gate force row level security;
revoke all on financeiro.sso_coordenacao_linhas_gate from public,anon,authenticated,service_role;
create function financeiro.sso_checar_quantidade_linha(p_proposta_id uuid,p_versao integer,p_linha_id uuid,p_adicional integer)
returns void language plpgsql volatile security definer set search_path='' as $$
declare item jsonb; qtd numeric;
begin
  if p_proposta_id is null or p_versao is null or p_linha_id is null or p_adicional is null or p_adicional<0 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select e into item from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=p_proposta_id and s.versao=p_versao and e->>'id'=p_linha_id::text;
  if item is null or item->>'quantidade' is null or item->>'quantidade' !~ '^[1-9][0-9]{0,5}$' then raise exception 'linha_nao_comprovada' using errcode='23514'; end if;
  select coalesce((select sum(x.quantidade) from financeiro.sso_material_linha_proposta x where x.proposta_id=p_proposta_id and x.versao=p_versao and x.linha_id=p_linha_id),0)
    + coalesce((select sum(x.quantidade) from financeiro.sso_servicos_extra_declarados x join financeiro.sso_servicos_extra_decisoes y on y.declaracao_id=x.id and y.decisao='aceita' where x.proposta_id=p_proposta_id and x.versao=p_versao and x.linha_id=p_linha_id),0) into qtd;
  if qtd+p_adicional>(item->>'quantidade')::numeric then raise exception 'quantidade_agregada_excedida' using errcode='23514'; end if;
end $$;
revoke all on function financeiro.sso_checar_quantidade_linha(uuid,integer,uuid,integer) from public,anon,authenticated,service_role;

alter function financeiro.sso_decidir_servico_extra(uuid,uuid,uuid,text,text) rename to sso_decidir_servico_extra_base_0824;
revoke all on function financeiro.sso_decidir_servico_extra_base_0824(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_decidir_servico_extra(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_servicos_extra_declarados%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_coordenacao_linhas_gate where id),false) then return financeiro.sso_decidir_servico_extra_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_decisao,p_motivo); end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('servico-extra-decisao:'||p_request_id::text,0));
  select * into d from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from comercial.propostas where id=d.proposta_id and deleted_at is null and status='aceita' and versao_atual=d.versao for update;
  if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if p_decisao='aceita' and not exists(select 1 from financeiro.sso_servicos_extra_decisoes where id=p_request_id) then perform financeiro.sso_checar_quantidade_linha(d.proposta_id,d.versao,d.linha_id,d.quantidade); end if;
  return financeiro.sso_decidir_servico_extra_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_decisao,p_motivo);
end $$;
revoke all on function financeiro.sso_decidir_servico_extra(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;

alter function financeiro.sso_vincular_material_linha(uuid,uuid,uuid,uuid,integer,bigint,text) rename to sso_vincular_material_linha_base_0824;
revoke all on function financeiro.sso_vincular_material_linha_base_0824(uuid,uuid,uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_vincular_material_linha(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_linha_id uuid,p_quantidade integer,p_preco_unitario bigint,p_justificativa text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v financeiro.sso_material_proposta_vinculos%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_coordenacao_linhas_gate where id),false) then return financeiro.sso_vincular_material_linha_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_linha_id,p_quantidade,p_preco_unitario,p_justificativa); end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-material-linha:'||p_request_id::text,0));
  select * into v from financeiro.sso_material_proposta_vinculos where declaracao_id=p_declaracao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from comercial.propostas where id=v.proposta_id and deleted_at is null and status='aceita' and versao_atual=v.versao for update;
  if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from financeiro.sso_material_linha_proposta where request_id=p_request_id) then perform financeiro.sso_checar_quantidade_linha(v.proposta_id,v.versao,p_linha_id,p_quantidade); end if;
  return financeiro.sso_vincular_material_linha_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_linha_id,p_quantidade,p_preco_unitario,p_justificativa);
end $$;
revoke all on function financeiro.sso_vincular_material_linha(uuid,uuid,uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;

alter function financeiro.sso_reconhecer_linha_material(uuid,uuid,uuid,integer,bigint,date) rename to sso_reconhecer_linha_material_base_0824;
revoke all on function financeiro.sso_reconhecer_linha_material_base_0824(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
create function financeiro.sso_reconhecer_linha_material(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_quantidade integer,p_preco_unitario bigint,p_competencia date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v financeiro.sso_material_linha_proposta%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_coordenacao_linhas_gate where id),false) then return financeiro.sso_reconhecer_linha_material_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_quantidade,p_preco_unitario,p_competencia); end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  lock table financeiro.fechamentos_mensais in share mode;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidato-linha:'||p_request_id::text,0));
  select x.* into v from financeiro.sso_material_linha_proposta x join financeiro.sso_material_declaracoes d on d.id=x.declaracao_id and d.cliente_id=p_cliente_id where x.declaracao_id=p_declaracao_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from comercial.propostas where id=v.proposta_id and deleted_at is null and status='aceita' and versao_atual=v.versao for update;
  if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from financeiro.sso_candidato_linha_comandos where request_id=p_request_id) then perform financeiro.sso_checar_quantidade_linha(v.proposta_id,v.versao,v.linha_id,0); end if;
  return financeiro.sso_reconhecer_linha_material_base_0824(p_request_id,p_cliente_id,p_declaracao_id,p_quantidade,p_preco_unitario,p_competencia);
end $$;
revoke all on function financeiro.sso_reconhecer_linha_material(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
