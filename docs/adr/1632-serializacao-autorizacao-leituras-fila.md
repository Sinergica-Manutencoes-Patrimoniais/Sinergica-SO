# ADR-1632 — Serialização da autorização nas leituras legadas da fila

As leituras diretas da fila preventiva e da entrada de Visita validavam autorização sem manter a trava compartilhada do protocolo de revogação. Uma revogação confirmada após essa validação podia ser seguida pelo retorno de dados. As versões de listagem preventiva v2 e v3 delegam à leitura original.

As duas funções passam a adquirir a trava de autorização antes de verificar a concessão, usando o helper privado da ADR-1628, que exige READ COMMITTED. A operação concorrente recebe `55P03` (`autorizacao_em_alteracao`). Assinaturas, ACLs, escopo por Cliente, dados retornados e gates permanecem preservados; a alteração não habilita integração externa.
