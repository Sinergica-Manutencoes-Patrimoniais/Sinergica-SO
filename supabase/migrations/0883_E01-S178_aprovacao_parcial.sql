create table pcm.sso_aprovacao_parcial_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_aprovacao_parcial_gate(id,habilitado) values(true,false);
create table pcm.sso_aprovacoes_parciais_linhas(lote_id uuid not null,linha_chave text not null,ciclo integer not null,revisao integer not null,atributos jsonb not null,codigo_revision integer not null,campos_estruturados jsonb,ator_id uuid not null references auth.users(id),request_id uuid not null,motivo text not null,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave,ciclo),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_aprovacao_parcial_gate enable row level security;alter table pcm.sso_aprovacao_parcial_gate force row level security;
alter table pcm.sso_aprovacoes_parciais_linhas enable row level security;alter table pcm.sso_aprovacoes_parciais_linhas force row level security;
revoke all on pcm.sso_aprovacao_parcial_gate,pcm.sso_aprovacoes_parciais_linhas from public,anon,authenticated,service_role;
create trigger sso_aprovacoes_parciais_imutaveis before update or delete on pcm.sso_aprovacoes_parciais_linhas for each row execute function pcm.sso_guardar_campos_localizacao_staging();
create function pcm.sso_aprovar_linhas_parcialmente(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_itens jsonb,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_item jsonb;v_payload jsonb;v_resultado jsonb;v_ciclo integer;v_reabertura integer;v_codigo integer;v_pai text;
begin
 if not coalesce((select habilitado from pcm.sso_aprovacao_parcial_gate where id),false) or not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'aprovacao_parcial_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or jsonb_typeof(p_itens) is distinct from 'array' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_confirmado is not true then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_itens) x where jsonb_typeof(x) is distinct from 'object' or nullif(btrim(x->>'chave'),'') is null or jsonb_typeof(x->'atributos') is distinct from 'object' or jsonb_typeof(x->'codigoRevision') is distinct from 'number') or (select count(distinct x->>'chave') from jsonb_array_elements(p_itens) x)<>jsonb_array_length(p_itens) then raise exception 'selecao_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','aprovar_linhas_parcialmente','loteId',p_lote_id,'expectedRevision',p_expected_revision,'itens',p_itens,'motivo',btrim(p_motivo),'confirmado',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1),coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0) into v_ciclo,v_reabertura;
 if exists(select 1 from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>v_reabertura) then raise exception 'lote_ja_aprovado_integralmente' using errcode='23514';end if;
 for v_item in select value from jsonb_array_elements(p_itens) loop
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=v_item->>'chave';
  if not found or v_linha.atributos is distinct from v_item->'atributos' or exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=p_lote_id and r.linha_chave=v_linha.chave) or exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=v_linha.chave) or exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=v_linha.chave) or exists(select 1 from pcm.sso_aprovacoes_parciais_linhas a where a.lote_id=p_lote_id and a.linha_chave=v_linha.chave and a.ciclo=v_ciclo) then raise exception 'linha_indisponivel' using errcode='23514';end if;
  if not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=p_lote_id and c.linha_chave=v_linha.chave and c.ciclo=v_ciclo and c.atributos=v_linha.atributos and c.revisao>v_reabertura) then raise exception 'linha_nao_conferida' using errcode='23514';end if;
  select coalesce((select revisao from pcm.sso_codigo_staging where lote_id=p_lote_id and linha_chave=v_linha.chave),0) into v_codigo;
  if v_codigo is distinct from (v_item->>'codigoRevision')::integer then raise exception 'codigo_revision_obsoleto' using errcode='40001';end if;
  v_pai:=nullif(btrim(v_linha.atributos->>'referenciaPai'),'');
  if v_pai is not null and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=v_pai) and not exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=v_pai) and not exists(select 1 from pcm.sso_aprovacoes_parciais_linhas a join pcm.sso_levantamento_linhas l on l.lote_id=a.lote_id and l.chave=a.linha_chave where a.lote_id=p_lote_id and a.linha_chave=v_pai and a.ciclo=v_ciclo and a.atributos=l.atributos and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=a.lote_id and r.linha_chave=a.linha_chave)) and not exists(select 1 from jsonb_array_elements(p_itens) p join pcm.sso_levantamento_linhas l on l.lote_id=p_lote_id and l.chave=p->>'chave' join pcm.sso_conferencia_linhas c on c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos where l.chave=v_pai and p->'atributos'=l.atributos and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave)) then raise exception 'pai_nao_aprovado_ou_rejeitado' using errcode='23514';end if;
  -- 0884 valida e congela retrato estruturado antes de inserir aprovação.
 end loop;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_aprovacoes_parciais_linhas(lote_id,linha_chave,ciclo,revisao,atributos,codigo_revision,ator_id,request_id,motivo,campos_estruturados)
 select p_lote_id,x->>'chave',v_ciclo,v_lote.revisao,x->'atributos',(x->>'codigoRevision')::integer,auth.uid(),p_request_id,btrim(p_motivo),nullif(x->'camposEstruturados','null'::jsonb) from jsonb_array_elements(p_itens) x;
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'ciclo',v_ciclo,'requestId',p_request_id,'linhasAprovadas',jsonb_array_length(p_itens),'oficialAlterado',false);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.linhas_aprovadas_parcialmente','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'revision',v_lote.revisao,'ciclo',v_ciclo,'requestId',p_request_id,'motivo',btrim(p_motivo),'chaves',(select jsonb_agg(x->>'chave') from jsonb_array_elements(p_itens) x)));return v_resultado;
end;$$;
revoke all on function pcm.sso_aprovar_linhas_parcialmente(uuid,uuid,integer,jsonb,text,boolean) from public,anon,authenticated,service_role;

create or replace function pcm.sso_exigir_lote_conferido() returns trigger language plpgsql security definer set search_path='' as $$
declare v_aprovacao integer;v_atributos jsonb;v_codigo integer;v_congelado integer;v_ciclo integer;v_reabertura integer;
begin
 if not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'incorporacao_bloqueada_por_aprovacao' using errcode='55000';end if;
 perform 1 from pcm.sso_levantamentos where id=new.lote_id for update;if not found then raise exception 'lote_indisponivel' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1),coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),0) into v_ciclo,v_reabertura;
 select max(revisao) into v_aprovacao from pcm.sso_conferencia_lotes where lote_id=new.lote_id and revisao>v_reabertura;
 select atributos into v_atributos from pcm.sso_levantamento_linhas where lote_id=new.lote_id and chave=new.linha_chave;
 select revisao into v_codigo from pcm.sso_codigo_staging where lote_id=new.lote_id and linha_chave=new.linha_chave;v_codigo:=coalesce(v_codigo,0);
 if v_aprovacao is not null then
  if v_atributos is null or not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=v_ciclo and c.revisao<v_aprovacao and c.atributos=v_atributos) then raise exception 'linha_ou_lote_nao_conferido' using errcode='23514';end if;
  select codigo_revision into v_congelado from pcm.sso_conferencia_lote_codigos where lote_id=new.lote_id and conferencia_revision=v_aprovacao and linha_chave=new.linha_chave;
  if v_congelado is null or v_congelado<>v_codigo then raise exception 'codigo_apos_conferencia' using errcode='40001';end if;
 elsif not coalesce((select habilitado from pcm.sso_aprovacao_parcial_gate where id),false) or not exists(select 1 from pcm.sso_aprovacoes_parciais_linhas a where a.lote_id=new.lote_id and a.linha_chave=new.linha_chave and a.ciclo=v_ciclo and a.revisao>v_reabertura and a.atributos=v_atributos and a.codigo_revision=v_codigo) then raise exception 'linha_nao_aprovada' using errcode='23514';end if;
 return new;
end;$$;
