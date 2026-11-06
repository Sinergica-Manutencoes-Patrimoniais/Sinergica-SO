# ADR-0271 — Republicação da comunicação de visita

Status: proposta; não ativar sem revisão e testes.

Após retirada, o PCM pode publicar nova mensagem na mesma revisão com novo identificador; a anterior e suas ciências são preservadas e não restauradas. Um índice parcial permite apenas uma comunicação não retirada para cada Visita, OS e revisão. O UUID do pedido, ator e conteúdo ficam registrados: retry retorna a publicação anterior mesmo se já retirada, sem recriá-la. O lock da Visita serializa publicações, e o antigo comando é desativado. Não altera confirmação da Visita, ciência obrigatória ou envio externo.
