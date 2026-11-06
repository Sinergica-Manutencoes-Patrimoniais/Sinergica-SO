# ADR-1297 — Cancelamento de recepção manual incerta

## Contexto

Um pedido sem resposta pode estar em voo ou já ter criado um levantamento. Apagar a tentativa no navegador e gerar outro request não impede que o anterior seja aplicado mais tarde.

## Decisão

Criar cancelamento auditável por request, ator, Cliente e payload integral. Sob a mesma trava transacional usada pela recepção, o servidor devolve o recibo existente se o pedido já foi aplicado; caso contrário, grava impedimento permanente para aquele request. A recepção consulta esse impedimento sob a mesma trava antes de gravar. Cancelamento não apaga lote, nem histórico, nem afeta outros requests. Gate próprio nasce fechado; autorização atual e isolamento do Cliente são obrigatórios.

## Consequências

Uma tentativa pode ser abandonada de forma explícita e rastreável sem permitir que ela seja aplicada depois. Só após resposta confirmada de cancelamento o cliente poderá liberar a tentativa local. Perda de resposta mantém o mesmo request para consulta/repetição. Rollout exige atualização coordenada da função de recepção antes de abrir o gate, testes de concorrência nas duas ordens, replay, autorização, RLS e revisão adversarial. Nenhuma operação é habilitada por esta decisão.
