-- E01-S167 (SSO-001, P0 do Caderno Técnico do Fabrício) — conclui a transição 1:1 → 1:N entre
-- Chamado e OS, removendo o bloqueio estrutural legado.
--
-- POR QUE ISTO EXISTE COMO MIGRATION E NÃO COMO SCRIPT MANUAL
-- O corte estava pronto e revisado desde S167 em
-- `docs/planejamento/plano-manutencao/operacao/s167-transicao-1n.sql`, mas como script MANUAL —
-- e por isso nunca foi executado. Resultado: toda a engenharia de 1:N (sso_criar_os_chamado 0324,
-- sso_converter_chamado_integral 1047, guarda de escritores 1499, os_grupo_no_chamado 1586,
-- união de Chamado de campo 1429, processamento de origem 1420) existe, está testada, e recusa
-- com `55000 transicao_legada_incompleta` enquanto o índice legado existir. Virando migration, o
-- corte passa a ser reproduzível, testado em CI e aplicado junto com o resto do schema.
--
-- O QUE MUDA DE COMPORTAMENTO (e o que NÃO muda)
-- NÃO muda o caminho normal de 1 OS por Chamado: a numeração sai da trigger legada
-- `trg_ordens_servico_numero_chamado` e passa para `pcm.sso_numero_os_chamado_compativel()`
-- (migration 1500), cuja saída é idêntica quando não há token de comando — OS com Chamado recebe
-- o número do Chamado; OS sem Chamado recebe `PRE-xxxxxxxx`. Só com o gate de guarda aberto E um
-- token de comando na mesma transação a OS passa a receber `<numero-do-chamado>-OS-<uuid>`.
--
-- O gate `pcm.sso_guarda_multiplas_os_gate` é ABERTO aqui de propósito, e isso NÃO é ativação de
-- feature — é troca do mecanismo de proteção. Enquanto o índice existia, ele era quem impedia a
-- 2ª OS; a função de guarda (1499) só assume o papel quando o gate está aberto. Fechado + índice
-- ausente é justamente o estado inseguro (a própria guarda levanta
-- `guarda_multiplas_os_desabilitada` nesse caso). Abrir o gate na MESMA transação em que o índice
-- cai é o que mantém a proteção contínua: criar a 2ª OS sem token segue recusado, agora com
-- `novo_vinculo_exige_comando_chamado_os` (23514) em vez de violação de unicidade (23505).
--
-- O gate de feature `pcm.chamado_os_gate` continua FECHADO: criar várias OS pela UI segue exigindo
-- decisão operacional separada. Esta migration só remove o bloqueio ESTRUTURAL.
--
-- ORDEM DE APLICAÇÃO: a trigger nova é criada ANTES de a legada cair, e o gate de guarda abre
-- antes do índice cair — em nenhum instante a tabela fica sem numeração nem sem proteção contra
-- 2ª OS indevida.
--
-- POR QUE TUDO MORA DENTRO DE UM ÚNICO `do $corte$`
-- A primeira tentativa de deploy desta migration falhou em produção com
-- `25P01 LOCK TABLE can only be used in transaction blocks`, no primeiro statement. O motivo é
-- uma premissa errada que o projeto carregava: `.squawk.toml` e `scripts/lint-migrations.mjs`
-- afirmam que "o Supabase (CLI e GitHub Integration) roda cada arquivo de migration dentro de uma
-- transação". Para a CLI é verdade — por isso `supabase db reset` passava local. Para a GitHub
-- Integration, NÃO é: cada statement vai solto, em autocommit.
--
-- Isso importa muito mais do que o `lock`. Sem transação, uma falha no meio do corte deixaria a
-- tabela num estado intermediário — por exemplo com o índice legado já derrubado e o gate de
-- guarda ainda fechado, que é exatamente o estado inseguro descrito acima. Um bloco `do` é UM
-- statement: ou o corte inteiro acontece, ou nada acontece, nos dois ambientes. É por isso que o
-- DDL aqui sai por `execute` em vez de ficar no nível de cima.

do $corte$
declare v_criacao boolean; v_guarda boolean;
begin
  -- Já aplicado? Sair em silêncio. O deploy pode ser repetido (foi, nesta própria migration), e
  -- repetir não pode virar erro nem corte duplicado.
  if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is null
    and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'sso_numero_os_chamado' and not t.tgisinternal) then
    return;
  end if;

  -- Trava as duas tabelas antes de validar, para que nenhuma escrita concorrente entre entre a
  -- verificação e o corte. `nowait`: em vez de enfileirar lock exclusivo numa tabela quente (o
  -- que bloquearia todo o tráfego até o fim da fila), falha na hora — o deploy pode ser repetido
  -- num momento mais calmo sem ter causado indisponibilidade.
  lock table pcm.chamados, pcm.ordens_servico in access exclusive mode nowait;

  -- Pré-condição 1: a feature de múltiplas OS não pode já estar liberada.
  select habilitado into v_criacao from pcm.chamado_os_gate where id for update;
  select habilitado into v_guarda from pcm.sso_guarda_multiplas_os_gate where id for update;
  if v_criacao is distinct from false or v_guarda is distinct from false then
    raise exception 'gates_devem_estar_fechados' using errcode = '55000'; end if;

  -- Pré-condição 2: o índice legado precisa estar exatamente como a 0171 o criou. Se alguém já
  -- mexeu nele, parar — o corte assume esta forma.
  if not exists(select 1 from pg_catalog.pg_index i
      where i.indexrelid = pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado')
        and i.indrelid = 'pcm.ordens_servico'::regclass and i.indisunique and i.indisvalid
        and pg_catalog.pg_get_indexdef(i.indexrelid) like '%(chamado_id)%'
        and pg_catalog.pg_get_expr(i.indpred, i.indrelid)
            = '((chamado_id IS NOT NULL) AND (deleted_at IS NULL))') then
    raise exception 'indice_legado_inesperado' using errcode = '55000'; end if;

  -- Pré-condição 3: a trigger legada de numeração precisa estar ativa e ser a esperada.
  if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'trg_ordens_servico_numero_chamado' and not t.tgisinternal and t.tgenabled <> 'D'
      and t.tgfoid = 'pcm.fn_ordens_servico_sync_numero_chamado()'::regprocedure) then
    raise exception 'trigger_legada_inesperada' using errcode = '55000'; end if;

  -- Pré-condição 4: a guarda nova precisa já estar instalada, e a numeração nova ainda não.
  if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'sso_guardar_novo_vinculo_chamado_os' and not t.tgisinternal and t.tgenabled <> 'D'
      and t.tgfoid = 'pcm.sso_guardar_novo_vinculo_chamado_os()'::regprocedure)
    or exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'sso_numero_os_chamado' and not t.tgisinternal) then
    raise exception 'guarda_ou_numeracao_inesperada' using errcode = '55000'; end if;

  -- Pré-condição 5: nenhum vínculo OS→Chamado órfão, apagado ou de Cliente trocado. Depois do
  -- corte o índice não existe mais para segurar inconsistência; entrar torto não é opção.
  if exists(select 1 from pcm.ordens_servico o
      left join pcm.chamados c on c.id = o.chamado_id
      where o.deleted_at is null and o.chamado_id is not null
        and (c.id is null or c.deleted_at is not null or c.cliente_id is distinct from o.client_id)) then
    raise exception 'vinculo_legado_inconsistente' using errcode = '23514'; end if;

  -- Pré-condição 6: o ponteiro singular legado (chamados.ordem_servico_id) precisa apontar para
  -- uma OS viva, do mesmo Cliente e do próprio Chamado.
  if exists(select 1 from pcm.chamados c
      left join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and c.ordem_servico_id is not null
        and (o.id is null or o.deleted_at is not null or o.client_id is distinct from c.cliente_id
             or o.chamado_id is distinct from c.id)) then
    raise exception 'referencia_singular_inconsistente' using errcode = '23514'; end if;

  -- 1) numeração nova entra antes de a legada sair
  execute 'create trigger sso_numero_os_chamado before insert on pcm.ordens_servico'
    || ' for each row execute function pcm.sso_numero_os_chamado_compativel()';

  -- 2) guarda assume o papel de proteção antes de o índice cair
  update pcm.sso_guarda_multiplas_os_gate set habilitado = true where id;

  -- 3) só agora o legado sai. `drop index concurrently` não existe aqui e não faria sentido: o
  -- lock exclusivo já está tomado desde o início, de propósito.
  execute 'drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico';
  execute 'drop index pcm.uq_ordens_servico_chamado';
end;
$corte$;
