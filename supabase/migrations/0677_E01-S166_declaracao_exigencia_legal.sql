-- ADR-0451: classificação declarada em rascunho; não valida exigência nem tolerância.
create table pcm.sso_exigencia_legal_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_exigencia_legal_gate enable row level security;
alter table pcm.sso_exigencia_legal_gate force row level security;
revoke all on pcm.sso_exigencia_legal_gate from public,anon,authenticated,service_role;
insert into pcm.sso_exigencia_legal_gate(id,habilitado) values(true,false);
create table pcm.sso_declaracoes_exigencia_rotina (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),
 revisao integer not null check(revisao>0),classificacao text not null check(classificacao in ('legal_normativa','nao_classificada')),
 referencia text,justificativa text not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),payload jsonb not null,resultado jsonb not null,unique(rotina_id,revisao)
);
alter table pcm.sso_declaracoes_exigencia_rotina enable row level security;
alter table pcm.sso_declaracoes_exigencia_rotina force row level security;
revoke all on pcm.sso_declaracoes_exigencia_rotina from public,anon,authenticated,service_role;
create trigger sso_exigencia_rotina_imutavel before update or delete on pcm.sso_declaracoes_exigencia_rotina for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_exigencia_rotina(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_plano integer,p_expected_declaracao integer,p_classificacao text,p_referencia text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;v_ant pcm.sso_declaracoes_exigencia_rotina%rowtype;v_rev integer;v_ref text:=nullif(btrim(p_referencia),'');v_motivo text:=nullif(btrim(p_justificativa),'');v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_exigencia_legal_gate where id),false) then raise exception 'exigencia_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_expected_plano is null or p_expected_plano<1 or p_expected_declaracao is null or p_expected_declaracao<0 or p_classificacao is null or p_classificacao not in ('legal_normativa','nao_classificada') or v_motivo is null or length(v_motivo)>2000 or length(coalesce(v_ref,''))>500 or (p_classificacao='legal_normativa' and v_ref is null) then raise exception 'declaracao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'revisaoPlano',p_expected_plano,'revisaoDeclaracao',p_expected_declaracao,'classificacao',p_classificacao,'referencia',v_ref,'justificativa',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exigencia-rotina-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_declaracoes_exigencia_rotina where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_plano.revisao<>p_expected_plano then raise exception 'revisao_plano_obsoleta' using errcode='40001'; end if;
 select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id where r.id=p_rotina_id and r.plano_id=p_plano_id and r.versao_id=p_versao_id and v.estado='rascunho' for share of r;
 if not found then raise exception 'rotina_rascunho_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_declaracoes_exigencia_rotina where rotina_id=p_rotina_id;
 if v_rev<>p_expected_declaracao then raise exception 'revisao_declaracao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'rotinaId',p_rotina_id,'revisao',v_rev+1,'modo',v_rotina.modo,'toleranciaAntes',v_rotina.tolerancia_antes,'toleranciaDepois',v_rotina.tolerancia_depois,'referenciaValidada',false,'toleranciaValidada',false,'snapshotAlterado',false);
 insert into pcm.sso_declaracoes_exigencia_rotina(request_id,cliente_id,plano_id,versao_id,rotina_id,revisao,classificacao,referencia,justificativa,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,v_rev+1,p_classificacao,v_ref,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.exigencia_rotina_declarada','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('classificacao',p_classificacao));return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_exigencia_rotina(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
