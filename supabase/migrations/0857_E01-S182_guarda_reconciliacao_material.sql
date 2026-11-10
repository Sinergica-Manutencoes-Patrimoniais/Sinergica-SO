create table financeiro.sso_guarda_reconciliacao_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_guarda_reconciliacao_material_gate(id,habilitado) values(true,false);
alter table financeiro.sso_guarda_reconciliacao_material_gate enable row level security;
alter table financeiro.sso_guarda_reconciliacao_material_gate force row level security;
revoke all on financeiro.sso_guarda_reconciliacao_material_gate from public,anon,authenticated,service_role;
alter function financeiro.sso_reconhecer_linha_material(uuid,uuid,uuid,integer,bigint,date) rename to sso_reconhecer_linha_material_base_0857;
revoke all on function financeiro.sso_reconhecer_linha_material_base_0857(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
create function financeiro.sso_reconhecer_linha_material(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_quantidade integer,p_preco_unitario bigint,p_competencia date)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from financeiro.sso_guarda_reconciliacao_material_gate where id),false) then
  return financeiro.sso_reconhecer_linha_material_base_0857(p_request_id,p_cliente_id,p_declaracao_id,p_quantidade,p_preco_unitario,p_competencia);
 end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 lock table financeiro.sso_reconciliacoes_servico_material in share mode;
 if not exists(select 1 from financeiro.sso_candidato_linha_comandos where request_id=p_request_id)
   and exists(select 1 from financeiro.sso_reconciliacoes_servico_material where cliente_id=p_cliente_id and material_id=p_declaracao_id) then
  raise exception 'reconciliacao_exige_revisao_nao_faturavel' using errcode='23514';
 end if;
 return financeiro.sso_reconhecer_linha_material_base_0857(p_request_id,p_cliente_id,p_declaracao_id,p_quantidade,p_preco_unitario,p_competencia);
end $$;
revoke all on function financeiro.sso_reconhecer_linha_material(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
