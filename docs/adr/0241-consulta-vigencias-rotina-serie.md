# ADR-0241 — Consulta de vigências e histórico Rotina–série

Status: proposta, não homologada.

Consultas paginadas expõem períodos de um vínculo autorizado e histórico mínimo de eventos por período. Requerem permissões atuais `plano.gerir` e `visita.confirmar`, escopo do Plano e série do mesmo Cliente; não modificam períodos ou criam ocorrências. Gate e funções permanecem fechados. Testes de isolamento, revogação, paginação e privacidade permanecem obrigatórios.
