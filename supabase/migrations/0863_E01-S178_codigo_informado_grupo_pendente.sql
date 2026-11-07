create table pcm.sso_codigo_grupo_pendente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_codigo_grupo_pendente_gate(id,habilitado) values(true,false);
create table pcm.sso_codigo_grupo_pendente_decisoes(lote_id uuid not null,linha_chave text not null,revisao integer not null,codigo_informado text not null,atributos jsonb not null,motivo text not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave,revisao),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_codigo_grupo_pendente_gate enable row level security;alter table pcm.sso_codigo_grupo_pendente_gate force row level security;
alter table pcm.sso_codigo_grupo_pendente_decisoes enable row level security;alter table pcm.sso_codigo_grupo_pendente_decisoes force row level security;
revoke all on pcm.sso_codigo_grupo_pendente_gate,pcm.sso_codigo_grupo_pendente_decisoes from public,anon,authenticated,service_role;
create trigger sso_codigo_grupo_pendente_imutavel before update or delete on pcm.sso_codigo_grupo_pendente_decisoes for each row execute function pcm.sso_guardar_campos_localizacao_staging();
create function pcm.sso_decidir_codigo_grupo_pendente(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_atributos jsonb,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_codigo text;
begin
 if not coalesce((select habilitado from pcm.sso_codigo_grupo_pendente_gate where id),false) then raise exception 'decisao_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_atributos) is distinct from 'object' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_confirmado is not true then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','codigo_grupo_manter_pendente','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'atributos',p_atributos,'motivo',btrim(p_motivo),'confirmado',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo<>'grupo_quantitativo' or v_linha.atributos is distinct from p_atributos or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514';end if;
 if jsonb_typeof(v_linha.atributos->'codigoInformado') is distinct from 'string' then raise exception 'codigo_informado_ausente' using errcode='22023';end if;
 v_codigo:=v_linha.atributos->>'codigoInformado';if length(btrim(v_codigo)) not between 1 and 200 then raise exception 'codigo_informado_invalido' using errcode='22023';end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_codigo_grupo_pendente_decisoes(lote_id,linha_chave,revisao,codigo_informado,atributos,motivo,ator_id,request_id) values(p_lote_id,p_chave,v_lote.revisao,v_codigo,v_linha.atributos,btrim(p_motivo),auth.uid(),p_request_id);
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id,'codigoAtribuido',false,'criacaoLiberada',false,'estado','pendente');
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.codigo_grupo_pendente','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id,'motivo',btrim(p_motivo)));return v_resultado;
end;$$;
revoke all on function pcm.sso_decidir_codigo_grupo_pendente(uuid,uuid,integer,text,jsonb,text,boolean) from public,anon,authenticated,service_role;
create function pcm.sso_historico_codigo_grupo_pendente(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer) returns table(revisao integer,codigo_informado text,atributos jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_codigo_grupo_pendente_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 return query select d.revisao,d.codigo_informado,d.atributos,d.motivo,d.ator_id,d.criado_em from pcm.sso_codigo_grupo_pendente_decisoes d where d.lote_id=p_lote_id and d.linha_chave=p_chave and (p_apos is null or d.revisao<p_apos) order by d.revisao desc limit p_limite;
end;$$;
revoke all on function pcm.sso_historico_codigo_grupo_pendente(uuid,text,integer,integer) from public,anon,authenticated,service_role;
