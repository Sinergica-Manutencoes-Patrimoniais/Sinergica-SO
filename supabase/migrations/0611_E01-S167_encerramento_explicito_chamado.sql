-- ADR-0385: wrapper auditado, sem alteração de OS.
create table pcm.sso_encerramento_chamado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_encerramento_chamado_gate enable row level security;
alter table pcm.sso_encerramento_chamado_gate force row level security;
revoke all on pcm.sso_encerramento_chamado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_encerramento_chamado_gate(id,habilitado) values(true,false);
create table pcm.sso_encerramentos_chamado_conferidos (
 request_id uuid primary key,chamado_id uuid not null references pcm.chamados(id),revisao_anterior bigint not null,revisao_resultante bigint not null,
 motivo text not null check(length(btrim(motivo)) between 1 and 2000),payload jsonb not null,resultado jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_encerramentos_chamado_conferidos enable row level security;
alter table pcm.sso_encerramentos_chamado_conferidos force row level security;
revoke all on pcm.sso_encerramentos_chamado_conferidos from public,anon,authenticated,service_role;
create trigger sso_encerramento_chamado_imutavel before update or delete on pcm.sso_encerramentos_chamado_conferidos for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_encerrar_chamado_conferido(p_request_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_expected_revision bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_chamado pcm.chamados%rowtype;v_ant pcm.sso_encerramentos_chamado_conferidos%rowtype;v_payload jsonb;v_canonico jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) then raise exception 'encerramento_chamado_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'encerramento_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_encerramentos_chamado_conferidos where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_chamado.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 perform p.id from pcm.chamado_escopo_parcelas p where p.chamado_id=p_chamado_id order by p.id for update;
 perform c.id from pcm.chamado_continuacoes_propostas c where c.chamado_id=p_chamado_id order by c.id for update;
 perform o.id from pcm.ordens_servico o where o.chamado_id=p_chamado_id and o.deleted_at is null order by o.id for update;
 if not exists(select 1 from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id and declarada_completa) or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id=p_chamado_id)
 or exists(select 1 from pcm.chamado_escopo_parcelas p left join pcm.ordens_servico o on o.id=p.os_atendimento_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where p.chamado_id=p_chamado_id and (p.situacao<>'atendida' or o.id is null))
 or exists(select 1 from pcm.chamado_continuacoes_propostas c left join pcm.ordens_servico o on o.id=c.os_continuacao_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where c.chamado_id=p_chamado_id and (c.situacao='pendente' or (c.situacao='executada' and o.id is null)))
 or not exists(select 1 from pcm.ordens_servico where chamado_id=p_chamado_id and deleted_at is null) or exists(select 1 from pcm.ordens_servico where chamado_id=p_chamado_id and deleted_at is null and (client_id is distinct from p_cliente_id or status is distinct from 'finalizado')) then raise exception 'escopo_nao_atendido' using errcode='23514'; end if;
 if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_token_encerramento_chamado(txid,chamado_id) values(pg_catalog.txid_current(),p_chamado_id);
 v_canonico:=pcm.sso_comando_escopo_chamado(gen_random_uuid(),p_cliente_id,p_chamado_id,p_expected_revision,'encerrar',null,null,null,null);
 delete from pcm.sso_token_encerramento_chamado where txid=pg_catalog.txid_current() and chamado_id=p_chamado_id;
 v_resultado:=jsonb_build_object('chamadoId',p_chamado_id,'revision',v_canonico->'revision','requestId',p_request_id,'osAlteradas',false);
 insert into pcm.sso_encerramentos_chamado_conferidos(request_id,chamado_id,revisao_anterior,revisao_resultante,motivo,payload,resultado,ator_id) values(p_request_id,p_chamado_id,p_expected_revision,(v_canonico->>'revision')::bigint,btrim(p_motivo),v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.encerramento_conferido','chamados',p_chamado_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_encerrar_chamado_conferido(uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
