-- ADR-0339: declaração de PCM no rascunho, sem alterar questionário Auvo.
create table pcm.sso_contrato_pergunta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_contrato_pergunta_gate enable row level security;
alter table pcm.sso_contrato_pergunta_gate force row level security;
revoke all on pcm.sso_contrato_pergunta_gate from public,anon,authenticated,service_role;
insert into pcm.sso_contrato_pergunta_gate(id,habilitado) values(true,false);
create table pcm.sso_contratos_pergunta_rascunho (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,plano_id uuid not null references pcm.planos_manutencao(id),
 versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),questionario_id uuid not null references pcm.questionarios(id),
 pergunta_id text not null,pergunta_fonte jsonb not null,obrigatoria boolean not null,revisao_plano integer not null,
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(plano_id,revisao_plano)
);
create index sso_contrato_pergunta_indice on pcm.sso_contratos_pergunta_rascunho(versao_id,rotina_id,pergunta_id,revisao_plano desc);
alter table pcm.sso_contratos_pergunta_rascunho enable row level security;
alter table pcm.sso_contratos_pergunta_rascunho force row level security;
revoke all on pcm.sso_contratos_pergunta_rascunho from public,anon,authenticated,service_role;
create trigger sso_contrato_pergunta_imutavel before update or delete on pcm.sso_contratos_pergunta_rascunho for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_configurar_obrigatoriedade_pergunta(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_obrigatoria boolean,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;v_ant pcm.sso_contratos_pergunta_rascunho%rowtype;v_questionario pcm.questionarios%rowtype;v_pergunta jsonb;v_num integer;v_payload jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_contrato_pergunta_gate where id),false) then raise exception 'contrato_pergunta_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1 or p_versao_id is null or p_rotina_id is null or p_pergunta_id is null or length(btrim(p_pergunta_id)) not between 1 and 250 or p_obrigatoria is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'contrato_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'expectedRevision',p_expected_revision,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'perguntaId',p_pergunta_id,'obrigatoria',p_obrigatoria,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_contratos_pergunta_rascunho where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('contratoId',v_ant.id,'revision',v_ant.revisao_plano,'requestId',p_request_id); end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_plano.estado<>'rascunho' then raise exception 'plano_nao_editavel' using errcode='23514'; end if;
 select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id and v.estado='rascunho' where r.id=p_rotina_id and r.plano_id=p_plano_id and r.versao_id=p_versao_id for share of r,v;
 if not found or v_rotina.questionario_id is null then raise exception 'rotina_ou_questionario_indisponivel' using errcode='23514'; end if;
 select * into v_questionario from pcm.questionarios where id=v_rotina.questionario_id and ativo for share;
 if not found or jsonb_typeof(v_questionario.perguntas) is distinct from 'array' then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_num,v_pergunta from jsonb_array_elements(v_questionario.perguntas) x(item) where x.item->>'id'=p_pergunta_id;
 if v_num<>1 or jsonb_typeof(v_pergunta) is distinct from 'object' or jsonb_typeof(v_pergunta->'id') not in ('string','number') then raise exception 'pergunta_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.planos_manutencao set revisao=revisao+1,updated_at=now(),updated_by=v_actor where id=p_plano_id returning * into v_plano;
 insert into pcm.sso_contratos_pergunta_rascunho(request_id,plano_id,versao_id,rotina_id,questionario_id,pergunta_id,pergunta_fonte,obrigatoria,revisao_plano,justificativa,payload,ator_id) values(p_request_id,p_plano_id,p_versao_id,p_rotina_id,v_questionario.id,p_pergunta_id,v_pergunta,p_obrigatoria,v_plano.revisao,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.obrigatoriedade_pergunta_declarada','planos_manutencao',p_plano_id,jsonb_build_object('requestId',p_request_id,'contratoId',v_id,'rotinaId',p_rotina_id,'revision',v_plano.revisao));
 return jsonb_build_object('contratoId',v_id,'revision',v_plano.revisao,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_configurar_obrigatoriedade_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text) from public,anon,authenticated,service_role;
