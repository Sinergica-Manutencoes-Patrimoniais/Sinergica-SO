-- ADR-1606: somente conflitos de negócio explícitos das RPCs de reserva.
do $patch$
declare
 nome text; f regprocedure; d text; alterada text; mensagem text; alvo text;
 nomes text[] := array['sso_decidir_reserva_ciclo_legado','sso_prever_reserva_calendario_futuro','sso_decidir_reserva_calendario_futuro','sso_prever_reserva_visita_futura','sso_decidir_reserva_visita_futura','sso_prever_reserva_calendario_rascunho','sso_escolher_reserva_calendario_rascunho','sso_prever_reserva_visita_rascunho','sso_decidir_reserva_visita_rascunho'];
 mensagens text[] := array['revisao_obsoleta','plano_ou_revisao_indisponivel','fotografia_obsoleta','reserva_obsoleta','escolha_obsoleta'];
begin
 foreach nome in array nomes loop
  if (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='pcm' and p.proname=nome and p.prokind='f')<>1 then raise exception 'reserva_funcao_ausente_ou_ambigua: %',nome using errcode='55000'; end if;
  select p.oid::regprocedure into f from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='pcm' and p.proname=nome and p.prokind='f';
  d:=pg_catalog.pg_get_functiondef(f); alterada:=d;
  foreach mensagem in array mensagens loop
   alvo:=format('raise exception %L using errcode=''40001''',mensagem);
   alterada:=replace(alterada,alvo,format('raise exception %L using errcode=''P0013''',mensagem));
  end loop;
  if alterada=d then raise exception 'reserva_funcao_sem_conflito_esperado: %',nome using errcode='55000'; end if;
  execute alterada;
 end loop;
end; $patch$;
