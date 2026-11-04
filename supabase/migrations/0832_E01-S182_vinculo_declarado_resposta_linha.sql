-- ADR-0607: vínculo declarado; não comprova execução e não cria faturável.
create table financeiro.sso_vinculo_resposta_servico_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into financeiro.sso_vinculo_resposta_servico_gate(id,habilitado) values(true,false);
alter table financeiro.sso_vinculo_resposta_servico_gate enable row level security;
alter table financeiro.sso_vinculo_resposta_servico_gate force row level security;
revoke all on financeiro.sso_vinculo_resposta_servico_gate from public,anon,authenticated,service_role;
create table financeiro.sso_vinculos_resposta_servico(
  id uuid primary key, cliente_id uuid not null references pcm.clientes(id), snapshot_id uuid not null unique references financeiro.sso_snapshots_servico_extra(id),
  vinculo_evidencia_id uuid not null references pcm.sso_evidencias_por_resposta(id), resposta_id uuid not null unique references pcm.respostas_os_preparadas(id),
  quantidade integer not null check(quantidade>0), motivo text not null check(length(btrim(motivo)) between 1 and 1000),
  ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now());
alter table financeiro.sso_vinculos_resposta_servico enable row level security;
alter table financeiro.sso_vinculos_resposta_servico force row level security;
revoke all on financeiro.sso_vinculos_resposta_servico from public,anon,authenticated,service_role;
create trigger sso_vinculo_resposta_servico_imutavel before update or delete on financeiro.sso_vinculos_resposta_servico for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_declarar_vinculo_resposta_servico(p_request_id uuid,p_cliente_id uuid,p_snapshot_id uuid,p_vinculo_evidencia_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s financeiro.sso_snapshots_servico_extra%rowtype; d financeiro.sso_servicos_extra_declarados%rowtype;
  e pcm.sso_evidencias_por_resposta%rowtype; a financeiro.sso_vinculos_resposta_servico%rowtype; p comercial.propostas%rowtype; modo text;
begin
  if not coalesce((select habilitado from financeiro.sso_vinculo_resposta_servico_gate where id),false)
    or not coalesce((select habilitado from financeiro.sso_coordenacao_linhas_gate where id),false)
    or not coalesce((select habilitado from financeiro.sso_snapshot_servico_extra_gate where id),false)
    or not coalesce((select habilitado from pcm.sso_evidencia_resposta_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_snapshot_id is null or p_vinculo_evidencia_id is null
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-resposta-servico:'||p_request_id::text,0));
  select * into a from financeiro.sso_vinculos_resposta_servico where id=p_request_id;
  if found then
    if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.snapshot_id<>p_snapshot_id or a.vinculo_evidencia_id<>p_vinculo_evidencia_id or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',a.id,'declarado',true,'execucaoComprovada',false,'geraFaturavel',false);
  end if;
  select * into s from financeiro.sso_snapshots_servico_extra where id=p_snapshot_id and cliente_id=p_cliente_id;
  if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
  select * into d from financeiro.sso_servicos_extra_declarados where id=s.declaracao_id and cliente_id=p_cliente_id;
  select * into p from comercial.propostas where id=s.proposta_id and deleted_at is null for update;
  if not found or p.status<>'aceita' or p.versao_atual<>s.versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p.id) m;
  if modo is distinct from 'linhas' then raise exception 'modo_incompativel' using errcode='23514'; end if;
  perform financeiro.sso_checar_quantidade_linha(s.proposta_id,s.versao,s.linha_id,0);
  select v.* into e from pcm.sso_evidencias_por_resposta v join pcm.retorno_os_preparado r on r.id=v.retorno_id
    where v.id=p_vinculo_evidencia_id and r.cliente_id=p_cliente_id and r.os_id=d.os_id;
  if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
  insert into financeiro.sso_vinculos_resposta_servico(id,cliente_id,snapshot_id,vinculo_evidencia_id,resposta_id,quantidade,motivo,ator_id)
    values(p_request_id,p_cliente_id,s.id,e.id,e.resposta_id,s.quantidade,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.vinculo_resposta_declarado','ordens_servico',d.os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'snapshotId',s.id,'respostaId',e.resposta_id));
  return jsonb_build_object('requestId',p_request_id,'declarado',true,'execucaoComprovada',false,'geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_declarar_vinculo_resposta_servico(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
