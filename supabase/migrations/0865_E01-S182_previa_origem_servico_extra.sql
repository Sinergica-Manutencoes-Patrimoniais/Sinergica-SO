create table financeiro.sso_previa_origem_servico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_previa_origem_servico_gate(id,habilitado) values(true,false);
alter table financeiro.sso_previa_origem_servico_gate enable row level security;
alter table financeiro.sso_previa_origem_servico_gate force row level security;
revoke all on financeiro.sso_previa_origem_servico_gate from public,anon,authenticated,service_role;
create function financeiro.sso_previa_origem_servico_extra(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare diagnostico jsonb;
begin
 if not coalesce((select habilitado from financeiro.sso_previa_origem_servico_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_fato_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 diagnostico:=financeiro.sso_diagnosticar_origens_fato_servico(p_cliente_id,p_fato_id);
 return jsonb_build_object('fatoId',p_fato_id,'diagnostico',diagnostico,'execucaoComprovada',false,'tipoServicoComprovado',false,'exclusividadeComprovada',false,'emissaoPermitida',false,'geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_previa_origem_servico_extra(uuid,uuid) from public,anon,authenticated,service_role;
