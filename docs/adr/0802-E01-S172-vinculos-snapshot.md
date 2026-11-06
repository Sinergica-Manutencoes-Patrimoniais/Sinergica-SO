# ADR 0802 — Vínculos declarados no snapshot parcial

Status: proposta; não homologada.

O snapshot V5 compõe a leitura V4 e os últimos eventos de vínculo para a revisão atual das disponibilidades nela incluídas, no mesmo snapshot do banco. Retorna no máximo 100 vínculos, com indicação de possível truncamento. Cada linha informa disponibilidade, intervalo, tipo, revisão e se a inclusão foi declarada ou retirada. Não transporta vínculos de revisões anteriores, não expõe justificativas ou identidade do ator no quadro agregado, e não modifica totais.

O acesso requer as permissões e gates de V4 e o gate da ADR 0798. A interface usa flag independente, mantém nomes e origens e não considera os vínculos prova de cobertura, exclusividade, ausência de sobreposição ou saldo; o histórico detalhado e a declaração continuam nas funções próprias. Intervalos sem evento não são incluídos no conjunto de vínculos; a ausência deles não implica cobertura. A saturação ou indisponibilidade mantém o quadro parcial. Gate fechado; revisão adversarial e homologação pendentes.
