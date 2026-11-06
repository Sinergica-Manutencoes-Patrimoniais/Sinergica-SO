-- ADR-1386: quantidades aprovadas e atuais são explicitamente distintas.
create table pcm.sso_registro_grupo_mediado_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_registro_grupo_mediado_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_registro_grupo_mediado_gate enable row level security;
alter table pcm.sso_registro_grupo_mediado_gate force row level security;
revoke all on pcm.sso_registro_grupo_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_previa_registro_grupo_mediada(p_cliente_id uuid,p_tipo text,p_preparada_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_atual jsonb;v_plano uuid;v_versao uuid;v_rotina uuid;v_alvo uuid;v_snapshot jsonb;v_item jsonb;v_n integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_registro_grupo_mediado_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_ocorrencia_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_ocorrencia_quantidade_aprovada_gate where id and habilitado for share;
 if not found then raise exception 'quantidade_aprovada_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_preparada_id is null or p_tipo is null or p_tipo not in ('calendario','visita')
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='calendario' then
   select o.plano_id,o.versao_id,o.rotina_id,o.alvo_id into v_plano,v_versao,v_rotina,v_alvo from pcm.ocorrencias_rotina_preparadas o
   join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo';
 else
   select o.plano_id,o.versao_id,o.rotina_id,o.alvo_id into v_plano,v_versao,v_rotina,v_alvo from pcm.ocorrencias_visita_preparadas o
   join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo'
   and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=o.visita_id and s.cliente_id=p_cliente_id);
 end if;
 if v_plano is null then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 v_atual:=pcm.sso_previa_registro_grupo(p_cliente_id,p_tipo,p_preparada_id);
 select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_versao and v.plano_id=v_plano and v.estado='aprovado' for share;
 if not found or jsonb_typeof(v_snapshot->'quantidades_grupo') is distinct from 'array' then raise exception 'quantidade_aprovada_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_n,v_item from jsonb_array_elements(v_snapshot->'quantidades_grupo') x(item)
   where x.item->>'rotinaId'=v_rotina::text and x.item->>'grupoId'=v_alvo::text;
 if v_n<>1 or coalesce(v_item->>'quantidade','') !~ '^[1-9][0-9]{0,15}$' or coalesce(v_item->>'revisao','') !~ '^[1-9][0-9]{0,8}$'
   or (v_item->>'quantidade')::numeric>9007199254740991 then raise exception 'quantidade_aprovada_invalida' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_atual||jsonb_build_object('quantidadeAprovada',v_item->>'quantidade','revisaoAprovada',(v_item->>'revisao')::integer);
end; $$;
revoke all on function pcm.sso_previa_registro_grupo_mediada(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_registro_grupo_mediada(uuid,text,uuid) to authenticated;

create function pcm.sso_registrar_ocorrencia_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_tipo text,p_preparada_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb; v_existente pcm.sso_ocorrencias_grupo%rowtype; v_origem pcm.sso_origens_quantidade_grupo%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_registro_grupo_mediado_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ocorrencia_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_ocorrencia_quantidade_aprovada_gate where id and habilitado for share;
 if not found then raise exception 'quantidade_aprovada_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_preparada_id is null or p_tipo is null or p_tipo not in ('calendario','visita')
   or p_expected_revision is null or p_expected_revision<1 or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ocorrencia-grupo:'||p_request_id::text,0));
 select * into v_existente from pcm.sso_ocorrencias_grupo where request_id=p_request_id;
 if found then
   select * into v_origem from pcm.sso_origens_quantidade_grupo where ocorrencia_id=v_existente.id;
   if not found or v_existente.ator_id is distinct from auth.uid() or v_existente.cliente_id is distinct from p_cliente_id
     or v_existente.payload is distinct from jsonb_build_object('clienteId',p_cliente_id,'tipo',p_tipo,'preparadaId',p_preparada_id)
     or v_origem.revisao_atual_registro is distinct from p_expected_revision then raise exception 'request_conflitante_ou_sem_fotografia' using errcode='23505'; end if;
   return jsonb_build_object('ocorrenciaGrupoId',v_existente.id,'requestId',p_request_id,'filaIntegrada',false,'osCriada',false);
 end if;
 v_resultado:=pcm.sso_registrar_ocorrencia_grupo_revisada(p_request_id,p_cliente_id,p_tipo,p_preparada_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_ocorrencia_grupo_mediada(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_ocorrencia_grupo_mediada(uuid,uuid,text,uuid,integer) to authenticated;
