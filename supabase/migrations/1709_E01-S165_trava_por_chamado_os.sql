-- ADR-1565: exclusão por identidade do Chamado, não por todas as tabelas.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_guardar_os_chamado_preventivo()'::regprocedure);
 a text:=$antes$ if tg_op='INSERT' then lock table pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita in share mode nowait;end if;$antes$;
 b text:=$depois$ if tg_op='INSERT' then
  perform 1 from pcm.chamados where id=new.chamado_id for update nowait;
  if not found then raise exception 'chamado_indisponivel' using errcode='23514';end if;
 end if;$depois$;
begin
 if 2<>(select count(*) from pg_catalog.pg_constraint c
  where c.contype='f' and c.confrelid='pcm.chamados'::regclass and not c.condeferrable and c.convalidated
   and c.conrelid in ('pcm.sso_chamados_ciclo_preventivo'::regclass,'pcm.sso_chamados_ciclo_visita'::regclass)
   and c.conkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='chamado_id' and not attisdropped)]::smallint[]
   and c.confkey=array[(select attnum from pg_catalog.pg_attribute where attrelid=c.confrelid and attname='id' and not attisdropped)]::smallint[]) then
  raise exception 'fks_chamado_incompativeis' using errcode='55000';end if;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_trava_chamado_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
