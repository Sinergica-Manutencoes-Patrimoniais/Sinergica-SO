# ADR-0522 — Triagem de candidatos a atraso

Status: preparada, gate fechado, não aplicada nem homologada. A lista paginada usa data de referência explicitamente fornecida e vencimento/tolerância congelados das ocorrências de calendário já preparadas. Informa existência de ponte e OS, sem presumir que a execução está pendente; é fotografia parcial, não fila oficial.

O PCM registra decisão preliminar versionada `avaliar` ou `tratar_manualmente`, com motivo e auditoria. Não cria ocorrência retroativa, não altera data-base/vencimento, OS ou Auvo e não decide dispensa ou conclusão. Fonte/fuso da data de referência, estados de execução e reconciliação ainda precisam de política e testes; homologação/revisão adversarial bloqueadas.
