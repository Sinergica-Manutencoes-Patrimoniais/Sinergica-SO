# ADR-0319 — Candidato faturável de linha aprovada

Status: proposta; gates fechados e testes pendentes.

O Financeiro pode reconhecer manualmente uma declaração aceita, já vinculada a linha de snapshot público aprovado, como candidato pendente. O servidor revalida Cliente, versão, modo linhas, quantidade, preço, total de vínculos e competência aberta; uma origem por declaração impede repetição. O lock da competência precede o lock da proposta. Nenhuma cobrança ou lançamento é criado. O controle ainda depende de inventário e reconciliação de origens legadas, revisão do contrato dos snapshots e testes de concorrência, antes de qualquer ativação.
