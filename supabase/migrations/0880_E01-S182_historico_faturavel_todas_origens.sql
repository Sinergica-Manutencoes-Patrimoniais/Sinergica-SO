create table financeiro.sso_historico_faturavel_todas_origens_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_historico_faturavel_todas_origens_gate(id,habilitado) values(true,false);
alter table financeiro.sso_historico_faturavel_todas_origens_gate enable row level security;
alter table financeiro.sso_historico_faturavel_todas_origens_gate force row level security;
revoke all on financeiro.sso_historico_faturavel_todas_origens_gate from public,anon,authenticated,service_role;
create or replace function financeiro.sso_historico_revisao_faturavel(p_cliente_id uuid,p_item_id uuid,p_apos integer default 1)
returns table(revisao integer,tipo text,valor_anterior_centavos text,valor_final_centavos text,motivo text,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or p_cliente_id is null or p_item_id is null or p_apos is null or p_apos<1 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not coalesce((select habilitado from financeiro.sso_candidato_linha_gate where id),false) and not coalesce((select habilitado from financeiro.sso_historico_faturavel_todas_origens_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 return query select e.revisao,e.tipo,e.valor_anterior_centavos::text,e.valor_final_centavos::text,e.motivo,e.ator_id,e.ocorrido_em from financeiro.sso_faturavel_eventos e where e.item_id=p_item_id and e.revisao>p_apos order by e.revisao limit 20;
end $$;
revoke all on function financeiro.sso_historico_revisao_faturavel(uuid,uuid,integer) from public,anon,authenticated,service_role;
