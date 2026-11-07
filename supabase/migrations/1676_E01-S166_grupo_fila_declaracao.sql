-- ADR-1533: evidência humana parcial; não cria unidades nem executa OS.
create table pcm.sso_declaracoes_fila_grupo (
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id), tipo text not null check(tipo in ('calendario','visita')),
 ciclo_id uuid not null, preparada_id uuid not null, grupo_id uuid not null, fila_revisao integer not null,
 fontes text not null, motivo text not null, fotografia jsonb not null, payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
create index sso_declaracoes_fila_grupo_ciclo on pcm.sso_declaracoes_fila_grupo(tipo,ciclo_id,criado_em desc,request_id desc);
alter table pcm.sso_declaracoes_fila_grupo enable row level security;
alter table pcm.sso_declaracoes_fila_grupo force row level security;
revoke all on pcm.sso_declaracoes_fila_grupo from public,anon,authenticated,service_role;
create trigger sso_declaracoes_fila_grupo_imutaveis before update or delete on pcm.sso_declaracoes_fila_grupo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Chamador adquire as travas das fontes antes de usar a fotografia.
create function pcm.sso_contexto_fila_grupo(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_grupo uuid;v_revisao integer;v_estado text;v_foto jsonb;v_total integer;v_efeitos integer;v_hash text;
begin
 if p_tipo='calendario' then
  select q.ciclo_id,q.revisao,q.estado,o.alvo_id into v_ciclo,v_revisao,v_estado,v_grupo
  from pcm.sso_fila_preventiva_pcm q join pcm.ocorrencias_rotina_preparadas o on o.id=q.preparada_id and o.plano_id=q.plano_id
  join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=o.id and cv.ciclo_id=q.ciclo_id
  where q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada and o.alvo_tipo='grupo';
 elsif p_tipo='visita' then
  select q.ciclo_id,q.revisao,q.estado,o.alvo_id into v_ciclo,v_revisao,v_estado,v_grupo
  from pcm.sso_fila_visita q join pcm.ocorrencias_visita_preparadas o on o.id=q.preparada_id and o.plano_id=q.plano_id
  join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=o.id and cv.ciclo_id=q.ciclo_id
  where q.cliente_id=p_cliente and q.plano_id=p_plano and q.preparada_id=p_preparada and o.alvo_tipo='grupo';
 else raise exception 'tipo_invalido' using errcode='22023'; end if;
 if not found or v_ciclo is null then raise exception 'fila_ou_grupo_indisponivel' using errcode='42501'; end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 v_total:=jsonb_array_length(v_foto->'grupo');
 select coalesce(sum(jsonb_array_length(value)),0)::integer into v_efeitos from jsonb_each(v_foto) where key<>'grupo';
 v_hash:=encode(pg_catalog.sha256(pg_catalog.convert_to(v_foto::text,'UTF8')),'hex');
 return jsonb_build_object('tipo',p_tipo,'preparadaId',p_preparada,'cicloId',v_ciclo,'grupoId',v_grupo,'filaRevisao',v_revisao,'filaEstado',v_estado,
  'gruposRegistrados',v_total,'efeitosLocais',v_efeitos,'fotografiaHash',v_hash,
  'confirmavel',v_estado='verificacao' and v_total=1 and (v_foto->'grupo'->0->>'grupo_id')=v_grupo::text and v_efeitos=0,
  'fontesExternasComprovadas',false,'fotografia',v_foto);
end; $$;
revoke all on function pcm.sso_contexto_fila_grupo(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_conferir_acesso_fila_grupo(p_ator uuid,p_cliente uuid,p_plano uuid,p_tipo text)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_cliente is null or p_plano is null or auth.uid() is null or auth.uid() is distinct from p_ator
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
  or (p_tipo='visita' and config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true)
  or not exists(select 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if p_tipo='calendario' then perform 1 from pcm.sso_fila_preventiva_pcm_gate where id and habilitado for share;
 else perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;end if;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_ocorrencia_grupo_gate where id and habilitado for share;
 if not found then raise exception 'grupo_desabilitado' using errcode='55000'; end if;
end; $$;
revoke all on function pcm.sso_conferir_acesso_fila_grupo(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_prever_fila_grupo(p_ator uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;
begin
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 lock table pcm.sso_fila_preventiva_pcm,pcm.sso_fila_visita in share mode nowait;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v:=pcm.sso_contexto_fila_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 return v-'fotografia';
end; $$;
revoke all on function pcm.sso_prever_fila_grupo(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_fila_grupo(uuid,uuid,uuid,uuid,text) to authenticated;

create function pcm.sso_declarar_fila_grupo(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text,p_fila_revisao integer,p_fotografia_hash text,p_fontes text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;v_payload jsonb;v_ant pcm.sso_declaracoes_fila_grupo%rowtype;v_resultado jsonb;
begin
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 if p_request is null or p_preparada is null or p_fila_revisao is null or p_fila_revisao<1 or p_fotografia_hash is null or p_fotografia_hash !~ '^[0-9a-f]{64}$'
  or p_fontes is null or length(btrim(p_fontes)) not between 1 and 2000 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente,'planoId',p_plano,'preparadaId',p_preparada,'tipo',p_tipo,'filaRevisao',p_fila_revisao,'fotografiaHash',p_fotografia_hash,'fontes',btrim(p_fontes),'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-grupo-declaracao:'||p_request::text,0));
 select * into v_ant from pcm.sso_declaracoes_fila_grupo where request_id=p_request;
 if found then
  if v_ant.ator_id is distinct from p_ator or v_ant.cliente_id is distinct from p_cliente or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505';end if;
  return v_ant.resultado;
 end if;
 lock table pcm.sso_fila_preventiva_pcm,pcm.sso_fila_visita in share mode nowait;
 perform pcm.sso_travar_fontes_impacto_grupo();
 perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente,p_preparada,p_tipo);
 v:=pcm.sso_contexto_fila_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 if (v->>'filaRevisao')::integer is distinct from p_fila_revisao or v->>'fotografiaHash' is distinct from p_fotografia_hash then raise exception 'fotografia_ou_fila_alterada' using errcode='40001';end if;
 if v->>'confirmavel' is distinct from 'true' then raise exception 'efeitos_ou_grupo_exigem_reconciliacao' using errcode='23514';end if;
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 v_resultado:=jsonb_build_object('requestId',p_request,'clienteId',p_cliente,'planoId',p_plano,'preparadaId',p_preparada,'tipo',p_tipo,'cicloId',v->>'cicloId','grupoId',v->>'grupoId','filaAlterada',false,'osAlteradas',false,'fontesExternasComprovadas',false);
 insert into pcm.sso_declaracoes_fila_grupo(request_id,ator_id,cliente_id,plano_id,tipo,ciclo_id,preparada_id,grupo_id,fila_revisao,fontes,motivo,fotografia,payload,resultado)
 values(p_request,p_ator,p_cliente,p_plano,p_tipo,(v->>'cicloId')::uuid,p_preparada,(v->>'grupoId')::uuid,p_fila_revisao,btrim(p_fontes),btrim(p_motivo),v->'fotografia',v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'preventiva.fila_grupo_declarada','planos_manutencao',p_plano,v_resultado||jsonb_build_object('fontes',btrim(p_fontes),'motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) to authenticated;

create function pcm.sso_declaracao_fila_grupo_atual(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_d pcm.sso_declaracoes_fila_grupo%rowtype;v_foto jsonb;
begin
 if p_tipo='calendario' then select ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes where preparada_id=p_preparada;
 elsif p_tipo='visita' then select ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes where preparada_id=p_preparada;
 else return false;end if;
 if v_ciclo is null then return false;end if;
 select * into v_d from pcm.sso_declaracoes_fila_grupo where cliente_id=p_cliente and plano_id=p_plano and tipo=p_tipo and ciclo_id=v_ciclo order by criado_em desc,request_id desc limit 1;
 if not found then return false;end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 return v_foto is not distinct from v_d.fotografia;
end; $$;
revoke all on function pcm.sso_declaracao_fila_grupo_atual(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

alter function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) rename to sso_estado_ocorrencia_vinculada_base_1676;
revoke all on function pcm.sso_estado_ocorrencia_vinculada_base_1676(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_estado_ocorrencia_vinculada(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;
begin
 v:=pcm.sso_estado_ocorrencia_vinculada_base_1676(p_cliente_id,p_plano_id,p_preparada_id);
 if v->>'estado'='indeterminado' and v->>'motivo'='sem_vinculo'
  and pcm.sso_declaracao_fila_grupo_atual(p_cliente_id,p_plano_id,p_preparada_id,'calendario') then
  v:=jsonb_set(jsonb_set(v,'{estado}',to_jsonb('candidata_aguardando'::text)),'{motivo}',to_jsonb('declaracao_pcm_parcial'::text));
 end if;
 return v;
end; $$;
revoke all on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) to authenticated;

alter function pcm.sso_estado_fila_visita(uuid,uuid,uuid) rename to sso_estado_fila_visita_base_1676;
revoke all on function pcm.sso_estado_fila_visita_base_1676(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_estado_fila_visita(p_cliente uuid,p_plano uuid,p_ciclo uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v text;v_preparada uuid;
begin
 v:=pcm.sso_estado_fila_visita_base_1676(p_cliente,p_plano,p_ciclo);
 if v='sem_vinculo' then
  select preparada_id into v_preparada from pcm.sso_fila_visita where ciclo_id=p_ciclo and cliente_id=p_cliente and plano_id=p_plano;
  if v_preparada is not null and pcm.sso_declaracao_fila_grupo_atual(p_cliente,p_plano,v_preparada,'visita') then return 'candidata';end if;
 end if;
 return v;
end; $$;
revoke all on function pcm.sso_estado_fila_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;
