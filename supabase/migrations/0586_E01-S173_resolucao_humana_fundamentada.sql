-- ADR-0360: resolução manual fundamentada, nunca automática.
create table pcm.sso_resolucao_pendencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_resolucao_pendencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_resolucao_pendencia_gate enable row level security;alter table pcm.sso_resolucao_pendencia_gate force row level security;
revoke all on pcm.sso_resolucao_pendencia_gate from public,anon,authenticated,service_role;
alter table pcm.sso_pendencias_tecnicas drop constraint sso_pendencias_tecnicas_estado_check;
alter table pcm.sso_pendencias_tecnicas add constraint sso_pendencias_tecnicas_estado_check check(estado in ('aberta','risco_aceito','dispensada','duplicada','resolvida'));
alter table pcm.sso_pendencias_decisoes drop constraint sso_pendencias_decisoes_decisao_check;
alter table pcm.sso_pendencias_decisoes add constraint sso_pendencias_decisoes_decisao_check check(decisao in ('risco_aceito','dispensada','duplicada','reaberta','resolvida'));
create table pcm.sso_resolucoes_pendencia(pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),revisao integer not null,evidencia_id uuid not null references pcm.retorno_evidencias_declaradas(id),retorno_id uuid not null references pcm.retorno_os_preparado(id),os_id uuid not null references pcm.ordens_servico(id),atestacao text not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(pendencia_id,revisao));
alter table pcm.sso_resolucoes_pendencia enable row level security;alter table pcm.sso_resolucoes_pendencia force row level security;
revoke all on pcm.sso_resolucoes_pendencia from public,anon,authenticated,service_role;
create function pcm.sso_resolucao_pendencia_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_resolucao_pendencia_imutavel() from public,anon,authenticated,service_role;
create trigger sso_resolucao_pendencia_imutavel before update or delete on pcm.sso_resolucoes_pendencia for each row execute function pcm.sso_resolucao_pendencia_imutavel();
create function pcm.sso_resolver_pendencia_humana(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_evidencia_id uuid,p_atesta_condicao boolean,p_atestacao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_p pcm.sso_pendencias_tecnicas%rowtype;v_cmd pcm.sso_pendencias_comandos%rowtype;v_e pcm.retorno_evidencias_declaradas%rowtype;v_r pcm.retorno_os_preparado%rowtype;v_os pcm.ordens_servico%rowtype;v_num integer;v_decisao text;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_resolucao_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_evidencia_id is null or p_atesta_condicao is not true or p_atestacao is null or length(btrim(p_atestacao)) not between 1 and 2000 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','resolver_humana','pendenciaId',p_pendencia_id,'revision',p_revision,'evidenciaId',p_evidencia_id,'atestaCondicao',true,'atestacao',btrim(p_atestacao),'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pendencias:'||p_request_id::text,0));
  select * into v_cmd from pcm.sso_pendencias_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('execucao.validar',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_cmd.resultado;
  end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_p.estado<>'aberta' then raise exception 'transicao_invalida' using errcode='23514'; end if;
  select * into v_e from pcm.retorno_evidencias_declaradas where id=p_evidencia_id;
  if not found or v_e.criado_em<=v_p.criado_em then raise exception 'evidencia_indisponivel' using errcode='23514'; end if;
  select * into v_r from pcm.retorno_os_preparado where id=v_e.retorno_id and cliente_id=v_p.cliente_id for update;
  if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
  select o.* into v_os from pcm.ordens_servico o join pcm.sso_atribuicoes_parcela a on a.os_id=o.id and a.cliente_id=o.client_id and a.chamado_id=o.chamado_id join pcm.sso_backlog_parcelas b on b.parcela_id=a.parcela_id and b.cliente_id=a.cliente_id and b.chamado_id=a.chamado_id where b.pendencia_id=v_p.id and o.id=v_r.os_id and o.client_id=v_p.cliente_id and o.status='finalizado' and o.deleted_at is null for update of o;
  if not found then raise exception 'os_corretiva_nao_comprovada' using errcode='23514'; end if;
  select count(*),min(d.decisao) into v_num,v_decisao from pcm.decisoes_validacao_os d where d.retorno_id=v_r.id and d.created_at=(select max(x.created_at) from pcm.decisoes_validacao_os x where x.retorno_id=v_r.id);
  if v_num<>1 or v_decisao is distinct from 'aprovar' then raise exception 'retorno_nao_aprovado' using errcode='23514'; end if;
  update pcm.sso_pendencias_tecnicas set estado='resolvida',revisao=revisao+1 where id=v_p.id returning * into v_p;
  insert into pcm.sso_pendencias_decisoes(pendencia_id,revisao,decisao,motivo,ator_id,request_id) values(v_p.id,v_p.revisao,'resolvida',btrim(p_motivo),v_ator,p_request_id);
  insert into pcm.sso_resolucoes_pendencia(pendencia_id,revisao,evidencia_id,retorno_id,os_id,atestacao,ator_id,request_id) values(v_p.id,v_p.revisao,p_evidencia_id,v_r.id,v_os.id,btrim(p_atestacao),v_ator,p_request_id);
  v_resultado:=jsonb_build_object('pendenciaId',v_p.id,'revision',v_p.revisao,'estado',v_p.estado,'requestId',p_request_id);
  insert into pcm.sso_pendencias_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_p.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'pendencia.resolucao_humana','pendencia_tecnica',v_p.id,v_resultado||jsonb_build_object('evidenciaId',p_evidencia_id,'retornoId',v_r.id,'osId',v_os.id,'atestacao',btrim(p_atestacao),'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_resolver_pendencia_humana(uuid,uuid,integer,uuid,boolean,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_evidencias_resolucao(p_pendencia_id uuid,p_revision integer,p_apos uuid,p_limite integer)
returns table(id uuid,tipo text,referencia text,descricao text,os_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_resolucao_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  return query select e.id,e.tipo,e.referencia,e.descricao,o.id,e.criado_em from pcm.sso_backlog_parcelas b join pcm.sso_atribuicoes_parcela a on a.parcela_id=b.parcela_id and a.cliente_id=b.cliente_id and a.chamado_id=b.chamado_id join pcm.ordens_servico o on o.id=a.os_id and o.client_id=b.cliente_id and o.chamado_id=b.chamado_id and o.deleted_at is null and o.status='finalizado' join pcm.retorno_os_preparado r on r.os_id=o.id and r.cliente_id=v_p.cliente_id join pcm.retorno_evidencias_declaradas e on e.retorno_id=r.id and e.criado_em>v_p.criado_em
    where b.pendencia_id=v_p.id and b.cliente_id=v_p.cliente_id and (p_apos is null or e.id>p_apos) and (select count(*) from pcm.decisoes_validacao_os d where d.retorno_id=r.id and d.created_at=(select max(x.created_at) from pcm.decisoes_validacao_os x where x.retorno_id=r.id))=1 and (select d.decisao from pcm.decisoes_validacao_os d where d.retorno_id=r.id order by d.created_at desc limit 1)='aprovar' order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_evidencias_resolucao(uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
