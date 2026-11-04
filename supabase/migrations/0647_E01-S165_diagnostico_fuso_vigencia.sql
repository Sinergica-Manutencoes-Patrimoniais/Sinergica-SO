-- ADR-0421: apenas comparação informativa de datas civis a partir das Visitas existentes.
create function pcm.sso_diagnosticar_fuso_vigencia(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_revisao integer; v_utc date; v_zonas jsonb; v_total integer; v_invalidos integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select revisao into v_revisao from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<>v_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_utc:=(pg_catalog.transaction_timestamp() at time zone 'UTC')::date;
 with zonas as (select distinct fuso from pcm.visitas where cliente_id=p_cliente_id),
 classificada as (select z.fuso,exists(select 1 from pg_catalog.pg_timezone_names t where t.name=z.fuso) valida from zonas z)
 select count(*),count(*) filter(where not valida) into v_total,v_invalidos from classificada;
 with zonas as (select distinct fuso from pcm.visitas where cliente_id=p_cliente_id),
 validas as (select z.fuso from zonas z where exists(select 1 from pg_catalog.pg_timezone_names t where t.name=z.fuso) order by z.fuso limit 50)
 select coalesce(jsonb_agg(jsonb_build_object('fusoDeclaradoVisitas',fuso,'dataCivil',(pg_catalog.transaction_timestamp() at time zone fuso)::date,'divergeUtc',((pg_catalog.transaction_timestamp() at time zone fuso)::date<>v_utc)) order by fuso),'[]'::jsonb) into v_zonas from validas;
 return jsonb_build_object('revisao',v_revisao,'instante',pg_catalog.transaction_timestamp(),'dataUtc',v_utc,'fusos',v_zonas,'totalFusosDeclarados',v_total,'fusosInvalidos',v_invalidos,'listaLimitada',v_total-v_invalidos>50,'fusoPlanoDefinido',false,'decisaoVigencia',false);
end; $$;
revoke all on function pcm.sso_diagnosticar_fuso_vigencia(uuid,uuid,integer) from public,anon,authenticated,service_role;
