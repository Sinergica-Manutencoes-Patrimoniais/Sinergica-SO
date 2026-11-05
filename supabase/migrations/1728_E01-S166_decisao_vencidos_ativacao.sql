-- ADR-1586: decisão preliminar também após ativação inicial.
do $migration$
declare v_def text; v_anterior text := $OLD$ or not exists(select 1 from pcm.plano_transicoes_historico h where h.plano_id=p_plano_id and h.acao='retomar')$OLD$;
begin
  select pg_get_functiondef('pcm.sso_registrar_decisao_vencimento(uuid,uuid,uuid,integer,uuid,uuid,integer,date,text,text)'::regprocedure) into v_def;
  if position(v_anterior in v_def) = 0 then raise exception 'decisao_vencimento_definicao_incompativel'; end if;
  v_def := replace(v_def, v_anterior, '');
  if position('if v_plano.revisao<>p_expected_revision then' in v_def) = 0 then raise exception 'decisao_vencimento_revisao_incompativel'; end if;
  v_def := replace(v_def, 'if v_plano.revisao<>p_expected_revision then',
    'if v_plano.estado = ''encerrado'' then raise exception ''plano_encerrado_somente_consulta'' using errcode=''23514''; end if; if v_plano.revisao<>p_expected_revision then');
  execute v_def;
end; $migration$;
