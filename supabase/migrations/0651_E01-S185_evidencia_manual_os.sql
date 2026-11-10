-- ADR-0425: declaração humana não equivale a prova ou resolução.
create table pcm.reconciliacao_os_evidencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.reconciliacao_os_evidencia_gate(id,habilitado) values(true,false);
alter table pcm.reconciliacao_os_evidencia_gate enable row level security;
alter table pcm.reconciliacao_os_evidencia_gate force row level security;
revoke all on pcm.reconciliacao_os_evidencia_gate from public,anon,authenticated,service_role;
create table pcm.reconciliacao_os_evidencias_manuais(
  request_id uuid primary key references pcm.reconciliacao_os_notas(request_id),
  resultado_declarado text not null check(resultado_declarado in ('nenhum','um','multiplos','desconhecido')),
  origem text not null check(length(btrim(origem)) between 1 and 200),
  referencia text not null check(length(btrim(referencia)) between 1 and 300),
  criado_em timestamptz not null default now()
);
alter table pcm.reconciliacao_os_evidencias_manuais enable row level security;
alter table pcm.reconciliacao_os_evidencias_manuais force row level security;
revoke all on pcm.reconciliacao_os_evidencias_manuais from public,anon,authenticated,service_role;
create trigger sso_evidencia_os_manual_imutavel before update or delete on pcm.reconciliacao_os_evidencias_manuais for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_declarar_evidencia_os_manual(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_updated_at timestamptz,p_sync text,p_task_id text,p_nota text,p_resultado text,p_origem text,p_referencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_anterior pcm.reconciliacao_os_evidencias_manuais%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_os_evidencia_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null
    or p_resultado is null or p_resultado not in ('nenhum','um','multiplos','desconhecido')
    or p_origem is null or length(btrim(p_origem)) not between 1 and 200
    or p_referencia is null or length(btrim(p_referencia)) not between 1 and 300 then raise exception 'evidencia_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_anotar_os_reconciliacao(p_request_id,p_cliente_id,p_os_id,p_updated_at,p_sync,p_task_id,p_nota);
  select * into v_anterior from pcm.reconciliacao_os_evidencias_manuais where request_id=p_request_id;
  if found then
    if v_anterior.resultado_declarado is distinct from p_resultado or v_anterior.origem is distinct from btrim(p_origem)
      or v_anterior.referencia is distinct from btrim(p_referencia) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  else
    insert into pcm.reconciliacao_os_evidencias_manuais(request_id,resultado_declarado,origem,referencia) values(p_request_id,p_resultado,btrim(p_origem),btrim(p_referencia));
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'integracao.evidencia_manual_os','ordens_servico',p_os_id,
      jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'resultadoDeclarado',p_resultado));
  end if;
  return jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'estado','declaracao_nao_verificada','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_declarar_evidencia_os_manual(uuid,uuid,uuid,timestamptz,text,text,text,text,text,text) from public,anon,authenticated,service_role;

