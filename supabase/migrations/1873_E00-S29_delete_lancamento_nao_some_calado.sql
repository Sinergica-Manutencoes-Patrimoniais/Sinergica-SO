-- E00-S29: corrige `financeiro.sso_proteger_lancamento_faturavel()`, que com a trava
-- `financeiro.sso_faturamento_gate` ABERTA engolia o DELETE de lançamento em silêncio.
--
-- COMO APARECEU
-- A migration 1872 abriu as travas do Financeiro e o pgTAP `financeiro_fechamento_mensal_rls`
-- passou a falhar em "mes fechado bloqueia DELETE" com `caught: no exception`. O teste estava
-- certo; quem estava errado era a função.
--
-- O DEFEITO
-- É um trigger `before delete or update ... for each row`. No caminho em que o lançamento NÃO tem
-- histórico de alocação nem estorno — o caso comum, de longe —, a função caía no `return new` do
-- fim. Em trigger `BEFORE DELETE`, `new` é NULL, e **retornar NULL cancela a operação**. Resultado
-- com o gate aberto: o DELETE não acontecia, e também não levantava erro. O operador apertava
-- excluir, o sistema dizia que deu certo, e o lançamento continuava lá.
--
-- Pior: a trava de mês fechado nunca chegava a ser consultada. Triggers de mesmo evento disparam
-- por ordem alfabética do nome, e `s182_proteger_lancamento_faturavel` vem antes de
-- `trg_lancamentos_bloqueio_mes_fechado`. O primeiro cancelava a operação, o segundo não rodava.
-- Não houve corrupção (nada era apagado), mas a competência fechada deixava de se defender com
-- erro — ela só parecia aceitar.
--
-- Com o gate FECHADO o defeito não existia, porque o `return early` do topo já distinguia DELETE
-- de UPDATE corretamente. Por isso ficou dois anos invisível: a trava nunca tinha sido aberta.
--
-- A CORREÇÃO
-- Uma linha: o retorno final passa a devolver `old` em DELETE e `new` nos demais, igual ao
-- `return early` do topo. Nenhuma regra de negócio muda — o que a função recusa e o que ela deixa
-- passar continua idêntico. O que muda é que "deixar passar" volta a significar passar de verdade,
-- entregando a decisão ao próximo trigger (o de mês fechado) em vez de abortar calado.
--
-- Reverso: `create or replace` com o corpo anterior (está em `0754_E01-S182_protecao_historico_canonico.sql`).
-- Prova: `supabase/tests/E00-S29_delete_lancamento_nao_some_calado.test.sql`.
create or replace function financeiro.sso_proteger_lancamento_faturavel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from financeiro.sso_faturamento_gate g where g.id), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if financeiro.sso_tem_historico_alocacao(null,null,old.id)
    or exists (select 1 from financeiro.sso_faturavel_conferencias_estorno c where c.lancamento_saida_id = old.id) then
    if tg_op = 'DELETE' then raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
    if new.tipo is distinct from old.tipo or new.cliente_id is distinct from old.cliente_id
      or new.os_id is distinct from old.os_id or new.data_competencia is distinct from old.data_competencia
      or new.valor_centavos is distinct from old.valor_centavos or new.origem is distinct from old.origem
      or new.categoria_id is distinct from old.categoria_id or new.conta_id is distinct from old.conta_id
      or new.data_vencimento is distinct from old.data_vencimento
      or (old.status = 'realizado' and (new.status is distinct from old.status or new.data_pagamento is distinct from old.data_pagamento)) then
      raise exception 'lancamento_faturavel_exige_fluxo_coordenado' using errcode = '23514'; end if;
  end if;
  -- Era `return new` seco. Em DELETE isso é NULL, e NULL cancela a operação sem erro.
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function financeiro.sso_proteger_lancamento_faturavel() from public, anon, authenticated, service_role;
