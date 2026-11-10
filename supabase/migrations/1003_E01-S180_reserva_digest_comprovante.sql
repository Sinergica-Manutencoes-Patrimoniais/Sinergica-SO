-- ADR-0806: somente preparação interna; o digest não é prova SQL dos bytes.
create table pcm.sso_ingestao_comprovante_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_ingestao_comprovante_gate(id,habilitado) values(true,false);
alter table pcm.sso_ingestao_comprovante_gate enable row level security;
alter table pcm.sso_ingestao_comprovante_gate force row level security;
revoke all on pcm.sso_ingestao_comprovante_gate from public,anon,authenticated,service_role;

create table pcm.sso_ingestao_comprovante_reservas(
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 despesa_id uuid not null references pcm.despesas_visita(id), digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 caminho text not null unique, criado_em timestamptz not null default now());
create table pcm.sso_ingestao_comprovante_confirmacoes(
 request_id uuid primary key references pcm.sso_ingestao_comprovante_reservas(request_id),
 objeto_id uuid not null unique, confirmado_em timestamptz not null default now());
alter table pcm.sso_ingestao_comprovante_reservas enable row level security;
alter table pcm.sso_ingestao_comprovante_reservas force row level security;
alter table pcm.sso_ingestao_comprovante_confirmacoes enable row level security;
alter table pcm.sso_ingestao_comprovante_confirmacoes force row level security;
revoke all on pcm.sso_ingestao_comprovante_reservas,pcm.sso_ingestao_comprovante_confirmacoes from public,anon,authenticated,service_role;

create function pcm.sso_ingestao_comprovante_imutavel() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'historico_imutavel' using errcode='23514'; end $$;
revoke all on function pcm.sso_ingestao_comprovante_imutavel() from public,anon,authenticated,service_role;
create trigger sso_ingestao_comprovante_reservas_imutaveis before update or delete on pcm.sso_ingestao_comprovante_reservas for each row execute function pcm.sso_ingestao_comprovante_imutavel();
create trigger sso_ingestao_comprovante_confirmacoes_imutaveis before update or delete on pcm.sso_ingestao_comprovante_confirmacoes for each row execute function pcm.sso_ingestao_comprovante_imutavel();

create function pcm.sso_ingestao_comprovante_interno(p_operacao text,p_usuario_id uuid,p_request_id uuid,p_despesa_id uuid,p_digest text,p_objeto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text; v_cliente uuid; v_caminho text; v_claims text; v_sub text; v_res pcm.sso_ingestao_comprovante_reservas%rowtype; v_objeto uuid; v_gate boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select habilitado into v_gate from pcm.sso_ingestao_comprovante_gate where id for share;
 if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 select habilitado into v_gate from pcm.sso_upload_comprovante_gate where id for share;
 if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if p_operacao not in ('autorizar','reservar','confirmar') or p_operacao is null or p_usuario_id is null or p_despesa_id is null or (p_operacao='autorizar' and (p_request_id is not null or p_digest is not null or p_objeto_id is not null)) or (p_operacao<>'autorizar' and (p_request_id is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$')) or (p_operacao='reservar' and p_objeto_id is not null) or (p_operacao='confirmar' and p_objeto_id is null) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select papel into v_papel from config.usuarios where user_id=p_usuario_id and ativo;
 if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true); v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 if p_operacao<>'autorizar' then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-comprovante:'||p_request_id::text,0)); end if;
 select cliente_id into v_cliente from pcm.despesas_visita where id=p_despesa_id and status='ativa' for share;
 if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_operacao='autorizar' then
   perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true); perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
   return 'true'::jsonb;
 end if;
 v_caminho:=v_cliente::text||'/'||p_despesa_id::text||'/'||p_request_id::text;
 select * into v_res from pcm.sso_ingestao_comprovante_reservas where request_id=p_request_id;
 if found and (v_res.ator_id is distinct from p_usuario_id or v_res.cliente_id is distinct from v_cliente or v_res.despesa_id is distinct from p_despesa_id or v_res.digest is distinct from p_digest or v_res.caminho is distinct from v_caminho) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 if p_operacao='reservar' then
   if v_res.request_id is null then
     insert into pcm.sso_ingestao_comprovante_reservas(request_id,ator_id,cliente_id,despesa_id,digest,caminho) values(p_request_id,p_usuario_id,v_cliente,p_despesa_id,p_digest,v_caminho);
     insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_usuario_id,'despesa_visita.comprovante_reservado','despesas_visita',p_despesa_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_cliente));
     perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true); perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
     return jsonb_build_object('estado','nova','digest',p_digest,'clienteId',v_cliente,'caminho',v_caminho);
   end if;
   select objeto_id into v_objeto from pcm.sso_ingestao_comprovante_confirmacoes where request_id=p_request_id;
   perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true); perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
   return jsonb_build_object('estado',case when v_objeto is null then 'pendente' else 'concluida' end,'digest',p_digest,'clienteId',v_cliente,'caminho',v_caminho,'objetoId',v_objeto);
 end if;
 if v_res.request_id is null then raise exception 'reserva_nao_encontrada' using errcode='23503'; end if;
 select objeto_id into v_objeto from pcm.sso_ingestao_comprovante_confirmacoes where request_id=p_request_id;
 if v_objeto is not null then
   if v_objeto is distinct from p_objeto_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 else
   perform 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=p_objeto_id and o.name=v_caminho and o.bucket_id='sso-despesas-visita' and b.public is false for share of o;
   if not found then raise exception 'objeto_nao_encontrado' using errcode='42501'; end if;
   insert into pcm.sso_ingestao_comprovante_confirmacoes(request_id,objeto_id) values(p_request_id,p_objeto_id);
   insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_usuario_id,'despesa_visita.comprovante_confirmado','despesas_visita',p_despesa_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_cliente));
 end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true); perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return jsonb_build_object('objetoId',p_objeto_id);
end $$;
revoke all on function pcm.sso_ingestao_comprovante_interno(text,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
