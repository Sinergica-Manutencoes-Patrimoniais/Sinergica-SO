# ADR-0615 — Identidade interna revisada de fato declarado

Status: preparado, gate fechado, sem aplicação ou homologação.

Registra identificador interno imutável para vínculo resposta–serviço existente, com revisão PCM de retorno aprovada e corrente, Cliente e OS verificados, motivo e responsável. A revisão do retorno é serializada por lock do retorno. Repetições do mesmo pedido são idempotentes; resposta e vínculo não podem gerar dois registros nesta tabela.

Não se afirma que o fato físico é único ou comprovado: 0533 é evidência declarada, a aprovação é do retorno como um todo, e outra resposta ou outra origem pode descrever a mesma execução. Alterações posteriores da decisão PCM podem tornar a referência obsoleta: qualquer uso futuro deve revalidar a revisão, além de resolver identidade transversal, tipo da linha, quantidade e exclusividade entre origens. Não cria candidato, lançamento ou cobrança. Testar concorrência, permissões, ordem de locks e reconciliação de decisões legadas antes de ativar.
