create table pcm.sso_conferencia_campos_localizacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_campos_localizacao_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencias_campos_localizacao(lote_id uuid not null,linha_chave text not null,ciclo integer not null,revisao integer not null,revisao_campos integer not null,campos jsonb not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,motivo text not null,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave,ciclo,revisao),foreign key(lote_id,linha_chave,revisao_campos) references pcm.sso_campos_localizacao_staging(lote_id,linha_chave,revisao));
alter table pcm.sso_conferencia_campos_localizacao_gate enable row level security;alter table pcm.sso_conferencia_campos_localizacao_gate force row level security;
alter table pcm.sso_conferencias_campos_localizacao enable row level security;alter table pcm.sso_conferencias_campos_localizacao force row level security;
revoke all on pcm.sso_conferencia_campos_localizacao_gate,pcm.sso_conferencias_campos_localizacao from public,anon,authenticated,service_role;
create trigger sso_conferencias_campos_localizacao_imutaveis before update or delete on pcm.sso_conferencias_campos_localizacao for each row execute function pcm.sso_guardar_campos_localizacao_staging();
create function pcm.sso_conferir_campos_localizacao(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_revisao_campos integer,p_campos jsonb,p_motivo text,p_confirmado boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_campos pcm.sso_campos_localizacao_staging%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_ciclo integer;
begin
 if not coalesce((select habilitado from pcm.sso_conferencia_campos_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_campos_localizacao_staging_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_revisao_campos is null or p_revisao_campos<1 or jsonb_typeof(p_campos) is distinct from 'object' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_confirmado is not true then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','conferir_campos_localizacao','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'revisaoCampos',p_revisao_campos,'campos',p_campos,'motivo',btrim(p_motivo),'confirmado',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 if not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.atributos=v_linha.atributos) or exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)) then raise exception 'linha_nao_conferida_ou_lote_aprovado' using errcode='23514';end if;
 select * into v_campos from pcm.sso_campos_localizacao_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao desc limit 1;
 if not found or v_campos.revisao<>p_revisao_campos or v_campos.campos is distinct from p_campos then raise exception 'campos_obsoletos' using errcode='40001';end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_conferencias_campos_localizacao(lote_id,linha_chave,ciclo,revisao,revisao_campos,campos,ator_id,request_id,motivo) values(p_lote_id,p_chave,v_ciclo,v_lote.revisao,v_campos.revisao,v_campos.campos,auth.uid(),p_request_id,btrim(p_motivo));
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'revisaoCampos',v_campos.revisao,'ciclo',v_ciclo,'requestId',p_request_id,'oficialAlterado',false,'aprovacaoBloqueada',true);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_localizacao_conferidos','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'revision',v_lote.revisao,'revisaoCampos',v_campos.revisao,'ciclo',v_ciclo,'requestId',p_request_id,'motivo',btrim(p_motivo),'campos',v_campos.campos));return v_resultado;
end;$$;
revoke all on function pcm.sso_conferir_campos_localizacao(uuid,uuid,integer,text,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;
