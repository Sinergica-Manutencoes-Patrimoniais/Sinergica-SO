-- ADR-0098: somente banco local isolado; usa dblink_connect_u como superusuário.
-- Passe o conteúdo de 0319 na variável psql sso_migration para executá-la somente na transação revertida.
-- Sem variável, exige que 0319 já esteja disponível no banco de teste.
-- Verifica as fontes em subtransações revertidas, sem gravar dados.
begin;
\if :{?sso_migration}
select :'sso_migration' \gexec
\endif
create extension if not exists dblink with schema extensions;
select extensions.dblink_connect_u('s170_lock', 'dbname=postgres user=postgres');
create function pg_temp.escrita_travou(p_sql text) returns boolean language plpgsql as $$
declare v_livre boolean;
begin
  begin
    execute p_sql;
    select ok into v_livre from extensions.dblink('s170_lock', $query$select pg_try_advisory_xact_lock_shared(hashtextextended('sso-autorizacao-confirmacao-visita', 0))$query$) as t(ok boolean);
    raise exception 'rollback_verificacao' using errcode = 'P0001';
  exception when raise_exception then
    if sqlerrm <> 'rollback_verificacao' then raise; end if;
  end;
  return not v_livre;
end;
$$;
select plan(20);
select has_trigger('config', 'sso_concessoes', 'sso_serializar_autorizacao', 'concessões serializam');
select has_trigger('config', 'sso_usuario_perfis', 'sso_serializar_autorizacao', 'vínculos de perfis serializam');
select has_trigger('config', 'sso_perfis', 'sso_serializar_autorizacao', 'perfis serializam');
select has_trigger('config', 'sso_acoes', 'sso_serializar_autorizacao', 'ações serializam');
select has_trigger('config', 'sso_acao_modulos', 'sso_serializar_autorizacao', 'módulos elegíveis serializam');
select has_trigger('config', 'usuarios', 'sso_serializar_autorizacao', 'usuários serializam');
select has_trigger('config', 'usuario_modulos', 'sso_serializar_autorizacao', 'módulos individuais serializam');
select has_trigger('config', 'grupos', 'sso_serializar_autorizacao', 'grupos serializam');
select has_trigger('config', 'grupo_modulos', 'sso_serializar_autorizacao', 'módulos de grupo serializam');
select has_trigger('pcm', 'clientes', 'sso_serializar_autorizacao', 'Clientes serializam');
select ok(pg_temp.escrita_travou('update config.sso_concessoes set ativa = ativa where false'), 'escrita em concessões adquire trava');
select ok(pg_temp.escrita_travou('update config.sso_usuario_perfis set ativo = ativo where false'), 'escrita em vínculos adquire trava');
select ok(pg_temp.escrita_travou('update config.sso_perfis set ativo = ativo where false'), 'escrita em perfis adquire trava');
select ok(pg_temp.escrita_travou('update config.sso_acoes set nivel = nivel where false'), 'escrita em ações adquire trava');
select ok(pg_temp.escrita_travou('update config.sso_acao_modulos set nivel = nivel where false'), 'escrita em módulos elegíveis adquire trava');
select ok(pg_temp.escrita_travou('update config.usuarios set ativo = ativo where false'), 'escrita em usuários adquire trava');
select ok(pg_temp.escrita_travou('update config.usuario_modulos set nivel = nivel where false'), 'escrita em módulos individuais adquire trava');
select ok(pg_temp.escrita_travou('update config.grupos set ativo = ativo where false'), 'escrita em grupos adquire trava');
select ok(pg_temp.escrita_travou('update config.grupo_modulos set nivel = nivel where false'), 'escrita em módulos de grupo adquire trava');
select ok(pg_temp.escrita_travou('update pcm.clientes set ativo = ativo where false'), 'escrita em Clientes adquire trava');
select extensions.dblink_disconnect('s170_lock');
select * from finish();
rollback;
