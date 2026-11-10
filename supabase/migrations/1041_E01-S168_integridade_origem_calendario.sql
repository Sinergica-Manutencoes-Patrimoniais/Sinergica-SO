-- ADR-0853: regra adicional desativada até reconciliar fontes e escritores.
create table pcm.sso_integridade_retorno_calendario_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_integridade_retorno_calendario_gate(id,habilitado) values(true,false);
alter table pcm.sso_integridade_retorno_calendario_gate enable row level security;
alter table pcm.sso_integridade_retorno_calendario_gate force row level security;
revoke all on pcm.sso_integridade_retorno_calendario_gate from public,anon,authenticated,service_role;

do $migration$
declare
 v_def text;
 v_antigo text := $old$    if not found then raise exception 'vinculo_ocorrencia_nao_comprovado' using errcode='23514'; end if;
  end if;$old$;
 v_novo text := $new$    if not found then raise exception 'vinculo_ocorrencia_nao_comprovado' using errcode='23514'; end if;
    perform 1 from pcm.sso_integridade_retorno_calendario_gate g where g.id for share;
    if coalesce((select g.habilitado from pcm.sso_integridade_retorno_calendario_gate g where g.id),false) then
      v_origem := pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
      if v_origem->>'tipo' is distinct from 'calendario' or v_origem->>'versaoId' is distinct from v_ocorrencia.versao_id::text
        or v_origem->>'rotinaId' is distinct from v_ocorrencia.rotina_id::text then
        raise exception 'origem_calendario_incompativel' using errcode='23514';
      end if;
    end if;
  end if;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or (length(v_def)-length(replace(v_def,v_antigo,'')))/length(v_antigo)<>1 then raise exception 'classificador_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare
 v_def text;
 v_antigo text := $old$  if (v_ocorrencia is null) = (v_ocorrencia_grupo is null) or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;$old$;
 v_novo text := $new$  if (v_ocorrencia is null) = (v_ocorrencia_grupo is null) or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;
  if v_ocorrencia is not null and not exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_legada_id=v_ocorrencia and v.cliente_id=v_retorno.cliente_id) then
    perform 1 from pcm.sso_integridade_retorno_calendario_gate g where g.id for share;
    if coalesce((select g.habilitado from pcm.sso_integridade_retorno_calendario_gate g where g.id),false) then
      v_origem := pcm.sso_resolver_origem_execucao(v_retorno.cliente_id,v_ocorrencia);
      if v_origem->>'tipo' is distinct from 'calendario' or v_origem->>'versaoId' is distinct from v_retorno.versao_id::text
        or v_origem->>'rotinaId' is distinct from v_retorno.rotina_id::text
        or v_origem->>'alvoTipo' is distinct from v_rotina.alvo_tipo::text
        or v_origem->>'alvoId' is distinct from coalesce(v_rotina.sistema_id,v_rotina.equipamento_id,v_rotina.grupo_id)::text then
        raise exception 'origem_calendario_incompativel' using errcode='23514';
      end if;
    end if;
  end if;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or (length(v_def)-length(replace(v_def,v_antigo,'')))/length(v_antigo)<>1 then raise exception 'pendencia_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public,anon,authenticated,service_role;
