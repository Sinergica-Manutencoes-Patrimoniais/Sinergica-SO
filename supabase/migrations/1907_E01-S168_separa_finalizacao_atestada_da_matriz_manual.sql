-- E01-S168/E01-S200: o comando privado com retorno atestado mantém sua transição própria.
-- Reverso: restaurar o trecho de chamada ao RPC manual segundo a migration 0607 e reverter
-- a aplicação da matriz manual em 1905 na mesma janela.
do $separar_finalizacao$
declare
  v_funcao regprocedure :=
    'pcm.sso_finalizar_os_validada(uuid,uuid,uuid,uuid,integer,text,timestamptz)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_variavel text := ';v_status_result record;';
  v_antes text := $antigo$ select * into v_status_result from pcm.fn_operacao_alterar_status_lote(array[v_os.id],'finalizado');
 if v_status_result.sucesso is distinct from true then raise exception 'transicao_os_recusada' using errcode='23514'; end if;$antigo$;
  v_depois text := $novo$ update pcm.ordens_servico
 set status = 'finalizado', updated_at = now(), updated_by = v_actor
 where id = v_os.id and client_id = p_cliente_id and deleted_at is null
   and status = v_os.status and updated_at = v_os.updated_at;
 if not found then raise exception 'transicao_os_recusada' using errcode='23514'; end if;$novo$;
begin
  if pg_catalog.strpos(v_definicao, v_antes) = 0
     or pg_catalog.length(v_definicao) - pg_catalog.length(pg_catalog.replace(v_definicao, v_antes, ''))
        <> pg_catalog.length(v_antes)
     or pg_catalog.strpos(v_definicao, v_variavel) = 0 then
    raise exception 'definicao_finalizacao_incompativel' using errcode = '55000';
  end if;

  execute pg_catalog.replace(
    pg_catalog.replace(v_definicao, v_antes, v_depois), v_variavel, ';'
  );
end;
$separar_finalizacao$;
