# ADR 1631: serialização da autorização em transições de revisão

Iniciar, submeter e devolver revisão exigem autorização vigente. As transações dessas operações adquirem a trava compartilhada usada pela revogação antes de consultar concessões ou replay e exigem READ COMMITTED. Concorrência retorna 55P03 sem alterar o Plano; recibos e gates existentes permanecem intactos.
