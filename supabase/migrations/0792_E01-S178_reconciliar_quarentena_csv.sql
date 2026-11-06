create table pcm.sso_reconciliar_quarentena_csv_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reconciliar_quarentena_csv_gate(id,habilitado) values(true,false);
create table pcm.sso_quarentena_csv_reconciliacoes(quarentena_id uuid primary key references pcm.sso_quarentena_csv_lotes(id),lote_id uuid not null unique references pcm.sso_levantamentos(id),request_id uuid not null unique,revisao_quarentena integer not null,ator_id uuid not null references auth.users(id),resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_reconciliar_quarentena_csv_gate enable row level security;alter table pcm.sso_reconciliar_quarentena_csv_gate force row level security;
alter table pcm.sso_quarentena_csv_reconciliacoes enable row level security;alter table pcm.sso_quarentena_csv_reconciliacoes force row level security;
revoke all on pcm.sso_reconciliar_quarentena_csv_gate,pcm.sso_quarentena_csv_reconciliacoes from public,anon,authenticated,service_role;
create trigger sso_quarentena_csv_reconciliacoes_imutaveis before update or delete on pcm.sso_quarentena_csv_reconciliacoes for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_guardar_quarentena_reconciliada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from pcm.sso_quarentena_csv_lotes where id=new.lote_id for update;
 if exists(select 1 from pcm.sso_quarentena_csv_reconciliacoes where quarentena_id=new.lote_id) then raise exception 'quarentena_ja_reconciliada' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_quarentena_reconciliada() from public,anon,authenticated,service_role;
create trigger sso_guardar_quarentena_reconciliada before insert on pcm.sso_quarentena_csv_correcoes for each row execute function pcm.sso_guardar_quarentena_reconciliada();
create function pcm.sso_validar_quarentena_csv(p_quarentena_id uuid,p_apos integer,p_limite integer)
returns table(numero integer,erros text[],revisao_quarentena integer) language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_quarentena_csv_lotes%rowtype;v_revision integer;
begin
 if not coalesce((select habilitado from pcm.sso_reconciliar_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'reconciliacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_quarentena_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_lote from pcm.sso_quarentena_csv_lotes where id=p_quarentena_id;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select coalesce(max(revisao),0) into v_revision from pcm.sso_quarentena_csv_correcoes where lote_id=p_quarentena_id;
 return query with atuais as (
 select l.numero,coalesce(c.celulas,l.celulas) celulas from pcm.sso_quarentena_csv_linhas l left join lateral(select x.celulas from pcm.sso_quarentena_csv_correcoes x where x.lote_id=l.lote_id and x.numero=l.numero order by x.revisao desc limit 1)c on true where l.lote_id=p_quarentena_id
 ), dados as (select a.*,btrim(coalesce(a.celulas->>0,'')) chave,btrim(coalesce(a.celulas->>1,'')) tipo from atuais a)
 select d.numero,array_remove(array[
 case when jsonb_typeof(d.celulas) is distinct from 'array' or jsonb_array_length(d.celulas)<>10 then 'colunas_invalidas' end,
 case when length(d.chave) not between 1 and 200 then 'chave_invalida' end,
 case when d.chave<>'' and (select count(*) from dados o where o.chave=d.chave)>1 then 'chave_duplicada' end,
 case when d.tipo not in ('area','local','sublocal','sistema','equipamento','componente','grupo_quantitativo') then 'tipo_invalido' end,
 case when exists(select 1 from jsonb_array_elements(d.celulas) x where jsonb_typeof(x) is distinct from 'string' or length(x #>> '{}')>4000) then 'celula_invalida' end,
 case when octet_length(d.celulas::text)>30000 then 'registro_excede_limite' end
 ],null),v_revision from dados d where p_apos is null or d.numero>p_apos order by d.numero limit p_limite;
end; $$;
revoke all on function pcm.sso_validar_quarentena_csv(uuid,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_reconciliar_quarentena_csv(p_request_id uuid,p_quarentena_id uuid,p_expected_revision integer,p_confirma boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_q pcm.sso_quarentena_csv_lotes%rowtype;v_ant pcm.sso_quarentena_csv_reconciliacoes%rowtype;v_revision integer;v_apos integer:=null;v_linha record;v_pagina integer;v_linhas jsonb;v_resultado jsonb;v_lote_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_reconciliar_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'reconciliacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_quarentena_id is null or p_expected_revision is null or p_expected_revision<0 or p_confirma is not true then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliar-quarentena:'||p_request_id::text,0));
 select * into v_q from pcm.sso_quarentena_csv_lotes where id=p_quarentena_id for update;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_q.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_quarentena_csv_reconciliacoes where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.quarentena_id is distinct from p_quarentena_id or v_ant.revisao_quarentena<>p_expected_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 if exists(select 1 from pcm.sso_quarentena_csv_reconciliacoes where quarentena_id=p_quarentena_id) then raise exception 'quarentena_ja_reconciliada' using errcode='23505'; end if;
 select coalesce(max(revisao),0) into v_revision from pcm.sso_quarentena_csv_correcoes where lote_id=p_quarentena_id;
 if v_revision<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 loop
   v_pagina:=0;
   for v_linha in select * from pcm.sso_validar_quarentena_csv(p_quarentena_id,v_apos,100) loop
     if cardinality(v_linha.erros)>0 then raise exception 'registros_estruturalmente_invalidos' using errcode='23514'; end if;
     v_apos:=v_linha.numero;v_pagina:=v_pagina+1;
   end loop;
   exit when v_pagina<100;
 end loop;
 select jsonb_agg(jsonb_build_object('chave',btrim(celulas->>0),'tipo',btrim(celulas->>1),'atributos',jsonb_strip_nulls(jsonb_build_object('nome',nullif(celulas->>2,''),'observacoes',nullif(celulas->>3,''),'quantidade',nullif(celulas->>4,''),'codigoInformado',nullif(celulas->>5,''),'referenciaPai',nullif(celulas->>6,''),'sistemaProvisorio',nullif(celulas->>7,''),'localProvisorio',nullif(celulas->>8,''),'classificacao',nullif(celulas->>9,'')))) order by numero) into v_linhas from (select l.numero,coalesce(c.celulas,l.celulas) celulas from pcm.sso_quarentena_csv_linhas l left join lateral(select x.celulas from pcm.sso_quarentena_csv_correcoes x where x.lote_id=l.lote_id and x.numero=l.numero order by x.revisao desc limit 1)c on true where l.lote_id=p_quarentena_id) dados;
 if v_linhas is null then raise exception 'quarentena_vazia' using errcode='23514'; end if;
 v_resultado:=pcm.sso_receber_levantamento_manual(p_request_id,v_q.cliente_id,'planilha','quarentena:'||p_quarentena_id::text,v_linhas);
 v_lote_id:=(v_resultado->>'aggregateId')::uuid;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'quarentenaId',p_quarentena_id,'loteId',v_lote_id,'revisaoQuarentena',p_expected_revision,'quantidade',jsonb_array_length(v_linhas),'oficialAlterado',false);
 insert into pcm.sso_quarentena_csv_reconciliacoes(quarentena_id,lote_id,request_id,revisao_quarentena,ator_id,resultado) values(p_quarentena_id,v_lote_id,p_request_id,p_expected_revision,auth.uid(),v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.quarentena_reconciliada','sso_quarentena_csv_lotes',p_quarentena_id,v_resultado||jsonb_build_object('clienteId',v_q.cliente_id));return v_resultado;
end; $$;
revoke all on function pcm.sso_reconciliar_quarentena_csv(uuid,uuid,integer,boolean) from public,anon,authenticated,service_role;
