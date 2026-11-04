# ADR-1021 — Coordenação de declarações de feriado

Status: preparação privada, não homologada.

Preparar trava por Cliente entre fotografia e escritores da tabela de feriados declarados. A fotografia obtém trava compartilhada após os gates; triggers de inserção, alteração e exclusão tentam trava exclusiva e recusam contenção em vez de aguardar com uma linha já travada. Transferência entre Clientes, se algum escritor a tentar, coordena os dois escopos em ordem determinística. O gate nasce fechado e a fotografia preparada exige sua ativação para usar o protocolo.

Não substituir revisão dos demais escritores nem presumir que a trava abrange materialização ou integrações externas. Comandos existentes e seus gates devem ser implantados juntos; testar READ COMMITTED, reentrância, ordenação, revogação, mudanças de gate, duas sessões, rollback, FORCE RLS e revisão adversarial antes de liberar. Assinatura continua não sendo prova de feriado oficial.
