# ADR-1121 — Consulta direta de retorno parcial

Status: proposta local, não aplicada nem homologada.

O item selecionado no ranking pode ser aberto por identificador, com as mesmas capacidades, gates e vínculo de Cliente da lista de retornos. A leitura não assume que o item continua aguardando nem executa promoção. O operador deve reconferir revisão e descrição antes de usar os comandos existentes.

A consulta não é prova de parada, execução, exclusividade de escopo ou autorização posterior. Antes da ativação, testar isolamento, concorrência, revogação, sessão, visibilidade após mudança de estado, recuperação de pedidos e revisão adversarial. Gates seguem fechados.
