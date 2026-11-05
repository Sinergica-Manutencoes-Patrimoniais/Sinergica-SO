-- ADR-1648: autorização atual e replay não cruzam alteração de permissões.
create function config.sso_serializar_administracao_capacidades() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)
  ) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
end;
$$;
revoke all on function config.sso_serializar_administracao_capacidades() from public, anon, authenticated, service_role;

do $patch$
declare
  f regprocedure;
  definicao text;
  inicio text := E'\nbegin\n';
  protegido text := E'\nbegin\n  perform config.sso_serializar_administracao_capacidades();\n';
begin
  foreach f in array array[
    'config.sso_definir_concessao(uuid,integer,uuid,uuid,text,uuid,boolean,text)'::regprocedure,
    'config.sso_definir_perfil(uuid,integer,uuid,text,boolean,text)'::regprocedure,
    'config.sso_definir_vinculo_perfil(uuid,integer,uuid,uuid,boolean,text)'::regprocedure
  ] loop
    definicao := pg_catalog.pg_get_functiondef(f);
    if (length(definicao) - length(replace(definicao, inicio, ''))) / length(inicio) <> 1 then
      raise exception 'administracao_capacidades_incompativel: %', f using errcode = '55000';
    end if;
    execute replace(definicao, inicio, protegido);
  end loop;
end;
$patch$;
