-- 0145_E09-S10_portal_financeiro.sql — Sinérgica SO
-- Views dedicadas: expõem só obrigações do cliente, nunca custo, margem ou rentabilidade.
-- Views usam filtro obrigatório no claim; tabelas-base continuam negadas ao cliente-sindico.

create view financeiro.portal_faturas
with (security_barrier = true) as
select
  l.id,
  l.cliente_id,
  l.contrato_id,
  l.descricao,
  l.valor_centavos,
  l.data_competencia,
  l.data_vencimento,
  l.data_pagamento,
  case
    when l.status = 'realizado' then 'paga'
    when l.data_vencimento < current_date then 'vencida'
    else 'em_aberto'
  end as status
from financeiro.lancamentos l
where l.tipo = 'entrada'
  and l.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
  and auth.jwt() ->> 'user_role' = 'cliente-sindico';

create view financeiro.portal_cobrancas
with (security_barrier = true) as
select
  c.id,
  l.cliente_id,
  c.lancamento_id,
  c.tipo,
  c.status,
  c.linha_digitavel,
  c.qr_code,
  c.link_pagamento,
  c.valor_centavos,
  c.criado_em
from financeiro.cobrancas c
join financeiro.lancamentos l on l.id = c.lancamento_id
where l.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
  and auth.jwt() ->> 'user_role' = 'cliente-sindico';

grant select on financeiro.portal_faturas, financeiro.portal_cobrancas to authenticated;

