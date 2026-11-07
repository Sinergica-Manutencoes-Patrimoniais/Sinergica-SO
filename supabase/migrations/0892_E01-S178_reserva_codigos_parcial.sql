create table pcm.sso_reserva_codigo_parcial_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reserva_codigo_parcial_gate(id,habilitado) values(true,false);
create table pcm.sso_reservas_codigo_parcial(id uuid primary key default gen_random_uuid(),lote_id uuid not null,linha_chave text not null,ciclo integer not null,codigo text not null,ator_id uuid not null references auth.users(id),request_id uuid not null,criado_em timestamptz not null default now(),consumida_em timestamptz,entidade_id uuid,liberada_em timestamptz,liberada_por uuid references auth.users(id),motivo_liberacao text,foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave),unique(lote_id,linha_chave,ciclo),check(not (consumida_em is not null and liberada_em is not null)),check((liberada_em is null and liberada_por is null and motivo_liberacao is null) or (liberada_em is not null and liberada_por is not null and motivo_liberacao is not null)));
create unique index sso_reserva_codigo_parcial_ativa on pcm.sso_reservas_codigo_parcial(upper(btrim(codigo))) where consumida_em is null and liberada_em is null;
create table pcm.sso_reserva_codigo_permissao(txid bigint not null,lote_id uuid not null,linha_chave text not null,ator_id uuid not null,codigo text not null,primary key(txid,lote_id,linha_chave,ator_id));
alter table pcm.sso_reserva_codigo_parcial_gate enable row level security;alter table pcm.sso_reserva_codigo_parcial_gate force row level security;
alter table pcm.sso_reservas_codigo_parcial enable row level security;alter table pcm.sso_reservas_codigo_parcial force row level security;
alter table pcm.sso_reserva_codigo_permissao enable row level security;alter table pcm.sso_reserva_codigo_permissao force row level security;
revoke all on pcm.sso_reserva_codigo_parcial_gate,pcm.sso_reservas_codigo_parcial,pcm.sso_reserva_codigo_permissao from public,anon,authenticated,service_role;

create function pcm.sso_reservar_codigo_na_aprovacao_parcial() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_informado text;v_candidato text;v_codigo text;v_existentes bigint;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then raise exception 'reserva_codigo_desabilitada' using errcode='55000';end if;
 select l.tipo,nullif(btrim(l.atributos->>'codigoInformado'),'') into v_tipo,v_informado from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave;
 if v_tipo not in ('sistema','equipamento','componente') then return new;end if;
 select nullif(btrim(s.codigo),'') into v_candidato from pcm.sso_codigo_staging s where s.lote_id=new.lote_id and s.linha_chave=new.linha_chave;
 if v_informado is not null and v_candidato is not null and v_informado is distinct from v_candidato then raise exception 'codigos_divergentes' using errcode='23514';end if;
 v_codigo:=coalesce(v_candidato,v_informado);if v_codigo is null then return new;end if;
 if length(v_codigo)>200 or v_codigo<>upper(v_codigo) or v_codigo~'[[:space:]]' then raise exception 'codigo_invalido' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo) then raise exception 'codigo_indisponivel' using errcode='23505';end if;
 select (select count(*) from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)+(select count(*) from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo) into v_existentes;
 if v_existentes>1 then raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
 if v_existentes=1 then return new;end if;
 insert into pcm.sso_reservas_codigo_parcial(lote_id,linha_chave,ciclo,codigo,ator_id,request_id) values(new.lote_id,new.linha_chave,new.ciclo,v_codigo,new.ator_id,new.request_id);
 return new;
end;$$;
revoke all on function pcm.sso_reservar_codigo_na_aprovacao_parcial() from public,anon,authenticated,service_role;
create trigger sso_reservar_codigo_na_aprovacao_parcial after insert on pcm.sso_aprovacoes_parciais_linhas for each row execute function pcm.sso_reservar_codigo_na_aprovacao_parcial();

create function pcm.sso_guardar_codigo_reservado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_codigo text;v_antigo text;
begin
 if tg_table_name='sistemas' then v_codigo:=new.codigo;if tg_op='UPDATE' then v_antigo:=old.codigo;end if;
 elsif tg_table_name='equipamentos' then v_codigo:=new.identificador;if tg_op='UPDATE' then v_antigo:=old.identificador;end if;
 else v_codigo:=new.codigo;end if;
 if v_codigo is null or btrim(v_codigo)='' or (tg_op='UPDATE' and v_codigo is not distinct from v_antigo) then return new;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.consumida_em is null and r.liberada_em is null and upper(btrim(r.codigo))=upper(btrim(v_codigo))) and not exists(select 1 from pcm.sso_reserva_codigo_permissao p where p.txid=pg_catalog.txid_current() and p.ator_id=auth.uid() and upper(btrim(p.codigo))=upper(btrim(v_codigo))) then raise exception 'codigo_reservado' using errcode='23505';end if;
 return new;
end;$$;
revoke all on function pcm.sso_guardar_codigo_reservado() from public,anon,authenticated,service_role;
create trigger sso_guardar_codigo_reservado before insert or update of codigo,cliente_id on pcm.sistemas for each row execute function pcm.sso_guardar_codigo_reservado();
create trigger sso_guardar_codigo_reservado before insert or update of identificador,client_id on pcm.equipamentos for each row execute function pcm.sso_guardar_codigo_reservado();
create trigger sso_guardar_codigo_reservado before insert on pcm.sso_codigo_aliases for each row execute function pcm.sso_guardar_codigo_reservado();

alter function pcm.sso_incorporar_ativo_levantamento(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint) rename to sso_incorporar_ativo_levantamento_base_0892;
revoke all on function pcm.sso_incorporar_ativo_levantamento_base_0892(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint) from public,anon,authenticated,service_role;
create function pcm.sso_incorporar_ativo_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_local_id uuid,p_categoria_id uuid,p_sistema_id uuid,p_parent_id uuid,p_codigo text,p_quantidade bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_tipo text;v_ciclo integer;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then return pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then return pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);end if;
 select tipo into v_tipo from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if v_tipo in ('sistema','equipamento','componente') then
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
  if p_codigo is null or not exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.lote_id=p_lote_id and r.linha_chave=p_chave and r.ciclo=v_ciclo and r.consumida_em is null and r.liberada_em is null and r.codigo=p_codigo) then raise exception 'reserva_codigo_ausente_ou_obsoleta' using errcode='23514';end if;
  insert into pcm.sso_reserva_codigo_permissao(txid,lote_id,linha_chave,ator_id,codigo) values(pg_catalog.txid_current(),p_lote_id,p_chave,auth.uid(),p_codigo);
 end if;
 v_resultado:=pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);
 if v_tipo in ('sistema','equipamento','componente') then
  update pcm.sso_reservas_codigo_parcial set consumida_em=now(),entidade_id=(v_resultado->'linkedIds'->>'entidadeId')::uuid where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo and consumida_em is null and liberada_em is null;
  if not found then raise exception 'reserva_nao_consumida' using errcode='23514';end if;
  delete from pcm.sso_reserva_codigo_permissao where txid=pg_catalog.txid_current() and lote_id=p_lote_id and linha_chave=p_chave and ator_id=auth.uid();
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.reserva_codigo_consumida','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'requestId',p_request_id,'entidadeId',v_resultado->'linkedIds'->>'entidadeId'));
 end if;
 return v_resultado;
end;$$;
revoke all on function pcm.sso_incorporar_ativo_levantamento(uuid,uuid,integer,text,uuid,uuid,uuid,uuid,text,bigint) from public,anon,authenticated,service_role;
