-- ADR-0327: vínculo somente a comprovante histórico da própria despesa de origem.
create table financeiro.sso_anexo_faturavel_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_anexo_faturavel_gate(id,habilitado) values(true,false);
alter table financeiro.sso_anexo_faturavel_gate enable row level security;
alter table financeiro.sso_anexo_faturavel_gate force row level security;
revoke all on financeiro.sso_anexo_faturavel_gate from public,anon,authenticated,service_role;
create table financeiro.sso_anexos_faturaveis(id uuid primary key default gen_random_uuid(),item_id uuid not null references financeiro.itens_faturaveis(id),
  despesa_id uuid not null references pcm.despesas_visita(id),revisao_comprovante integer not null check(revisao_comprovante>0),
  objeto_id uuid not null references storage.objects(id),criado_por uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  unique(item_id,revisao_comprovante));
alter table financeiro.sso_anexos_faturaveis enable row level security;
alter table financeiro.sso_anexos_faturaveis force row level security;
revoke all on financeiro.sso_anexos_faturaveis from public,anon,authenticated,service_role;
create function financeiro.sso_vincular_comprovante_faturavel(p_item_id uuid,p_revisao integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; v_objeto uuid; v_caminho text; v_id uuid;
begin
  if auth.uid() is null or p_item_id is null or p_revisao is null or p_revisao<1 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from financeiro.sso_anexo_faturavel_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true or i.origem_tipo<>'despesa_visita'
    or not exists(select 1 from pcm.despesas_visita d where d.id=i.origem_id and d.cliente_id=i.cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select h.objeto,h.caminho into v_objeto,v_caminho from (
    select r.comprovante_objeto_id as objeto,r.comprovante_caminho as caminho from pcm.despesa_visita_realizacoes r where r.despesa_id=i.origem_id and r.revisao=p_revisao
    union all select c.objeto_novo,c.caminho_novo from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id=i.origem_id and c.revisao=p_revisao
  ) h;
  if v_objeto is null or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
    where o.id=v_objeto and o.name=v_caminho and o.bucket_id='sso-despesas-visita') then raise exception 'comprovante_indisponivel' using errcode='23514'; end if;
  insert into financeiro.sso_anexos_faturaveis(item_id,despesa_id,revisao_comprovante,objeto_id,criado_por) values(i.id,i.origem_id,p_revisao,v_objeto,auth.uid())
    on conflict(item_id,revisao_comprovante) do nothing returning id into v_id;
  if v_id is null then select id into v_id from financeiro.sso_anexos_faturaveis where item_id=i.id and revisao_comprovante=p_revisao and objeto_id=v_objeto;
    if v_id is null then raise exception 'vinculo_conflitante' using errcode='23505'; end if;
  else insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.comprovante_vinculado','itens_faturaveis',i.id,jsonb_build_object('anexoId',v_id,'revisao',p_revisao,'clienteId',i.cliente_id)); end if;
  return v_id;
end $$;
revoke all on function financeiro.sso_vincular_comprovante_faturavel(uuid,integer) from public,anon,authenticated,service_role;
create function financeiro.sso_listar_comprovantes_faturavel(p_cliente_id uuid,p_item_id uuid,p_apos uuid default null)
returns table(id uuid,revisao integer,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id)
    or not coalesce((select habilitado from financeiro.sso_anexo_faturavel_gate where financeiro.sso_anexo_faturavel_gate.id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select a.id,a.revisao_comprovante,a.criado_em from financeiro.sso_anexos_faturaveis a where a.item_id=p_item_id and (p_apos is null or a.id>p_apos) order by a.id limit 20;
end $$;
revoke all on function financeiro.sso_listar_comprovantes_faturavel(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function financeiro.sso_anexo_faturavel_autorizado(p_anexo_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_caminho text;
begin
  if auth.uid() is null or not coalesce((select habilitado from financeiro.sso_anexo_faturavel_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select o.name into v_caminho from financeiro.sso_anexos_faturaveis a join financeiro.itens_faturaveis i on i.id=a.item_id and i.origem_tipo='despesa_visita' and i.origem_id=a.despesa_id
    join pcm.despesas_visita d on d.id=a.despesa_id and d.cliente_id=i.cliente_id
    join storage.objects o on o.id=a.objeto_id and o.bucket_id='sso-despesas-visita' join storage.buckets b on b.id=o.bucket_id and b.public is false
    where a.id=p_anexo_id and config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is true
      and (exists(select 1 from pcm.despesa_visita_realizacoes r where r.despesa_id=d.id and r.revisao=a.revisao_comprovante and r.comprovante_objeto_id=o.id and r.comprovante_caminho=o.name)
        or exists(select 1 from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id=d.id and c.revisao=a.revisao_comprovante and c.objeto_novo=o.id and c.caminho_novo=o.name));
  if v_caminho is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_caminho;
end $$;
revoke all on function financeiro.sso_anexo_faturavel_autorizado(uuid) from public,anon,authenticated,service_role;
