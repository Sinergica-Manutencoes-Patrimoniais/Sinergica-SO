-- E01-S196 — corrige a contingência Auvo, que estava autorizada para NINGUÉM além do superadmin.
--
-- ACHADO (homologação de 24/11/2026, com conta de teste real em produção): a capacidade
-- `execucao.contingencia_auvo` nasceu na `1863` com linha em `config.sso_acoes`, mas SEM linha
-- correspondente em `config.sso_acao_modulos`. Desde a `0246`, `config.sso_autorizar_acao` não lê
-- mais o módulo de `sso_acoes` — ela faz `join config.sso_acao_modulos am on am.acao = a.codigo`.
-- Sem essa linha, o `exists` da checagem de módulo é sempre falso, e a capacidade é negada mesmo
-- com concessão nominal válida e módulo `pcm` com nível `escrita`.
--
-- Por que ninguém viu antes: `superadmin` tem desvio explícito na mesma condição
-- (`u.papel = 'superadmin' or exists (...)`), então para o administrador a contingência sempre
-- respondeu `true`. Quem testa como administrador nunca encontra este buraco.
--
-- PROVA EM PRODUÇÃO, mesma conta, mesmo cliente, duas capacidades individuais de `pcm`/`escrita`:
--   config.sso_autorizar_acao('plano.gerir')               -> true
--   config.sso_autorizar_acao('execucao.contingencia_auvo')-> false
-- A única diferença entre as duas é a ausência da linha de elegibilidade.
--
-- As outras quatro capacidades criadas depois da `0246` (`anexo_os.publicar`,
-- `orcamento.dispensar`, `orcamento.excecao_preco`, `orcamento.operacional.ler`) estão corretas:
-- a `1795` declarou a elegibilidade das quatro. Esta é a única que ficou de fora.
--
-- Reverso: delete from config.sso_acao_modulos
--            where acao = 'execucao.contingencia_auvo' and modulo = 'pcm';
--          (volta a negar a contingência para todo mundo que não é superadmin)
--
-- Aditiva: nenhuma concessão, nenhum evento de auditoria e nenhuma linha de usuário é tocada.
-- Quem não tinha concessão de `execucao.contingencia_auvo` continua sem poder nada — esta
-- migration só devolve a elegibilidade de módulo que a `1863` deveria ter declarado.
insert into config.sso_acao_modulos (acao, modulo, nivel)
  values ('execucao.contingencia_auvo', 'pcm', 'escrita')
on conflict (acao, modulo) do nothing;

-- Guarda contra a repetição: toda ação do catálogo precisa de pelo menos uma elegibilidade de
-- módulo, senão ela nasce morta para qualquer papel que não seja superadmin. Falha a migration em
-- vez de deixar passar silenciosamente, no mesmo espírito da `1795`.
do $migration$
declare
  v_orfas text;
begin
  select string_agg(a.codigo, ', ' order by a.codigo) into v_orfas
  from config.sso_acoes a
  where not exists (select 1 from config.sso_acao_modulos m where m.acao = a.codigo);
  if v_orfas is not null then
    raise exception 'capacidade_sem_modulo_elegivel: %', v_orfas using errcode = '55000';
  end if;
end;
$migration$;
