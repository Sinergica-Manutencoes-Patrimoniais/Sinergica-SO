create table financeiro.sso_revisao_origens_reconciliacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_revisao_origens_reconciliacao_gate(id,habilitado) values(true,false);
alter table financeiro.sso_revisao_origens_reconciliacao_gate enable row level security;
alter table financeiro.sso_revisao_origens_reconciliacao_gate force row level security;
revoke all on financeiro.sso_revisao_origens_reconciliacao_gate from public,anon,authenticated,service_role;
create table financeiro.sso_revisoes_origens_reconciliacao(decisao_id uuid primary key references financeiro.sso_reconciliacoes_servico_material(id),
 material_revisao integer not null check(material_revisao>0),material_estado text not null check(material_estado in ('pendente','aceita','rejeitada')),
 servico_id uuid not null references financeiro.sso_servicos_extra_declarados(id),criado_em timestamptz not null default now());
alter table financeiro.sso_revisoes_origens_reconciliacao enable row level security;
alter table financeiro.sso_revisoes_origens_reconciliacao force row level security;
revoke all on financeiro.sso_revisoes_origens_reconciliacao from public,anon,authenticated,service_role;
create trigger sso_revisao_origens_reconciliacao_imutavel before update or delete on financeiro.sso_revisoes_origens_reconciliacao for each row execute function pcm.sso_proteger_nota_reconciliacao();
alter function financeiro.sso_decidir_reconciliacao_servico_material(uuid,uuid,uuid,uuid,integer,text,text) rename to sso_decidir_reconciliacao_servico_material_base_0860;
revoke all on function financeiro.sso_decidir_reconciliacao_servico_material_base_0860(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_decidir_reconciliacao_servico_material(p_request_id uuid,p_cliente_id uuid,p_servico_id uuid,p_material_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m financeiro.sso_material_declaracoes%rowtype; resultado jsonb; existente boolean;
begin
 if not coalesce((select habilitado from financeiro.sso_revisao_origens_reconciliacao_gate where id),false) then
  return financeiro.sso_decidir_reconciliacao_servico_material_base_0860(p_request_id,p_cliente_id,p_servico_id,p_material_id,p_expected_revision,p_decisao,p_motivo);
 end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_servico_id is null or p_material_id is null
 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-servico-material-request:'||p_request_id::text,0));
 select exists(select 1 from financeiro.sso_reconciliacoes_servico_material where id=p_request_id) into existente;
 if existente then return financeiro.sso_decidir_reconciliacao_servico_material_base_0860(p_request_id,p_cliente_id,p_servico_id,p_material_id,p_expected_revision,p_decisao,p_motivo); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-servico-material-par:'||p_servico_id::text||':'||p_material_id::text,0));
 select * into m from financeiro.sso_material_declaracoes where id=p_material_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 resultado:=financeiro.sso_decidir_reconciliacao_servico_material_base_0860(p_request_id,p_cliente_id,p_servico_id,p_material_id,p_expected_revision,p_decisao,p_motivo);
 insert into financeiro.sso_revisoes_origens_reconciliacao(decisao_id,material_revisao,material_estado,servico_id) values(p_request_id,m.revisao,m.estado,p_servico_id);
 return resultado;
end $$;
revoke all on function financeiro.sso_decidir_reconciliacao_servico_material(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
