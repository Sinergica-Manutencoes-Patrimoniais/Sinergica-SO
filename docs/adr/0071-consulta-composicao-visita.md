# ADR-0071 — Consultas paginadas de composição da Visita

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

OS e equipe são consultadas por Visita e Cliente, após autorização atual, com páginas limitadas. Filtro explícito escolhe vínculos vigentes ou histórico completo; o histórico mantém identificação, data e motivo de encerramento. OS são ordenadas por sequência e ID para preservar empates históricos; equipe, por ID da participação. As respostas são projeções mínimas operacionais, sem custos, contatos ou dados privados adicionais.

Paginação deve ser reiniciada após alterações. O acesso segue `visita.confirmar` conservador até a governança de leitura de E01-S170 estar pronta. Consultas não executam integração ou alteram relações.
