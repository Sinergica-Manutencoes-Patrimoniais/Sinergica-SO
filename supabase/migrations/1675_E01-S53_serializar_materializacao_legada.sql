-- ADR-1532: materialização e edição estrutural usam a mesma trava do Plano legado.
do $migracao$
declare
 d text:=pg_catalog.pg_get_functiondef('pcm.materializar_ocorrencias_preventivas(uuid,date)'::regprocedure);
 a text:='select * into v_plano from pcm.planos_preventivos where id = p_plano_id;';
 b text:='select * into v_plano from pcm.planos_preventivos where id = p_plano_id for update;';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
  raise exception 'definicao_materializacao_legada_incompativel' using errcode='55000';
 end if;
 execute replace(d,a,b);
end; $migracao$;
