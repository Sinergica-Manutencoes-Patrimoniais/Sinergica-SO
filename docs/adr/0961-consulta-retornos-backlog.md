# ADR-0961 — Consulta privada de retornos por ciclo

Status: preparação isolada, não homologada.

Preparar listagem por Cliente das entradas criadas pela transição privada, com IDs de origem, ciclo, parcela, Chamado, OS e reconciliação, sem tratar declaração humana como prova de parada. A consulta toma gates e trava de autorização, usa cursor por UUID e retorna páginas limitadas; execução continua revogada. Interface experimental deve apresentar que a lista é separada, não é o ranking oficial nem permite promoção.

Páginas não formam snapshot e mudanças simultâneas podem alterar o conjunto. Não integrar ao Backlog oficial até provar migração de leitores/escritores, unicidade, priorização GUTD, autorização, parada e rollback. Não habilitar ou conceder acesso antes de testes e revisão adversarial.
