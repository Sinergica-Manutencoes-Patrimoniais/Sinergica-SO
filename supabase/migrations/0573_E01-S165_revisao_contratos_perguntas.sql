-- ADR-0347: wrapper transacional, copia somente contratos congelados e fonte idêntica.
create table pcm.sso_revisao_contrato_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_revisao_contrato_gate enable row level security;
alter table pcm.sso_revisao_contrato_gate force row level security;
revoke all on pcm.sso_revisao_contrato_gate from public,anon,authenticated,service_role;
insert into pcm.sso_revisao_contrato_gate(id,habilitado) values(true,false);
create table pcm.sso_revisoes_plano_contratos (
 request_id uuid primary key,plano_id uuid not null references pcm.planos_manutencao(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_revisoes_plano_contratos enable row level security;
alter table pcm.sso_revisoes_plano_contratos force row level security;
revoke all on pcm.sso_revisoes_plano_contratos from public,anon,authenticated,service_role;
create trigger sso_revisao_contratos_imutavel before update or delete on pcm.sso_revisoes_plano_contratos for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_iniciar_revisao_plano_com_contratos(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_nova_versao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_origem pcm.plano_versoes%rowtype;v_ant pcm.sso_revisoes_plano_contratos%rowtype;
 v_payload jsonb;v_iniciada jsonb;v_saida jsonb;v_item jsonb;v_rotina jsonb;v_pergunta jsonb;v_atual jsonb;v_id uuid;v_logica uuid;v_nova_rotina uuid;v_num integer;v_revision integer;v_copiados integer:=0;v_pendentes integer:=0;
begin
 if not coalesce((select habilitado from pcm.sso_revisao_contrato_gate where id),false) or not coalesce((select habilitado from pcm.sso_contrato_pergunta_gate where id),false) then raise exception 'revisao_contratos_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1 or p_nova_versao_id is null then raise exception 'revisao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'expectedRevision',p_expected_revision,'novaVersaoId',p_nova_versao_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_revisoes_plano_contratos where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_origem from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' order by numero desc limit 1 for update;
 if not found or jsonb_typeof(v_origem.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 v_iniciada:=pcm.sso_iniciar_revisao_plano(gen_random_uuid(),p_expected_revision,p_plano_id,p_nova_versao_id);v_revision:=(v_iniciada->>'revision')::integer;
 if jsonb_typeof(v_origem.snapshot->'contratos_perguntas')='array' then
  for v_item in select value from jsonb_array_elements(v_origem.snapshot->'contratos_perguntas') loop
   select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_origem.snapshot->'rotinas') x(item) where x.item->>'id'=v_item->>'rotinaId';
   if v_num<>1 or v_item->>'perguntaId' is null or jsonb_typeof(v_item->'obrigatoria') is distinct from 'boolean' or v_rotina->>'rotina_logica_id' is null or v_rotina->>'questionario_id' is distinct from v_item->>'questionarioId' or jsonb_typeof(v_rotina->'questionario'->'perguntas') is distinct from 'array' then v_pendentes:=v_pendentes+1;continue; end if;
   v_logica:=(v_rotina->>'rotina_logica_id')::uuid;v_nova_rotina:=(v_iniciada->'linkedIds'->>('rotina:'||v_logica::text))::uuid;
   select count(*),min(x.item::text)::jsonb into v_num,v_pergunta from jsonb_array_elements(v_rotina->'questionario'->'perguntas') x(item) where x.item->>'id'=v_item->>'perguntaId';
   if v_num<>1 or v_nova_rotina is null then v_pendentes:=v_pendentes+1;continue; end if;
   select count(*),min(x.item::text)::jsonb into v_num,v_atual from pcm.questionarios q cross join lateral jsonb_array_elements(case when jsonb_typeof(q.perguntas)='array' then q.perguntas else '[]'::jsonb end) x(item) where q.id=(v_item->>'questionarioId')::uuid and q.ativo and x.item->>'id'=v_item->>'perguntaId';
   if v_num<>1 or v_atual is distinct from v_pergunta then v_pendentes:=v_pendentes+1;continue; end if;
   v_saida:=pcm.sso_configurar_obrigatoriedade_pergunta(gen_random_uuid(),p_cliente_id,p_plano_id,v_revision,p_nova_versao_id,v_nova_rotina,v_item->>'perguntaId',(v_item->>'obrigatoria')::boolean,'Cópia de contrato congelado da versão anterior, com fonte idêntica.');
   v_revision:=(v_saida->>'revision')::integer;v_copiados:=v_copiados+1;
  end loop;
 else v_pendentes:=v_pendentes+1; end if;
 -- Novas perguntas podem ter surgido no questionário atual; não afirmar completude.
 v_saida:=v_iniciada||jsonb_build_object('requestId',p_request_id,'revision',v_revision,'contratosCopiados',v_copiados,'reconferenciaNecessaria',true,'itensNaoCopiados',v_pendentes);
 insert into pcm.sso_revisoes_plano_contratos(request_id,plano_id,ator_id,payload,resultado) values(p_request_id,p_plano_id,v_actor,v_payload,v_saida);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.revisao_contratos_copiados','planos_manutencao',p_plano_id,jsonb_build_object('requestId',p_request_id,'versaoId',p_nova_versao_id,'copiados',v_copiados,'naoCopiados',v_pendentes));
 return v_saida;
end; $$;
revoke all on function pcm.sso_iniciar_revisao_plano_com_contratos(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
