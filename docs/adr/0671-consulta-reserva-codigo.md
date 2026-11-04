# ADR-0671 — Consulta autorizada de reserva

Status: proposta; gates fechados, não homologada.

O PCM consulta por Cliente, lote e linha a reserva mais recente, seu ciclo e situação ativa, consumida ou liberada. Ausência de registro não demonstra disponibilidade global nem que o código pertence ao cadastro; pode tratar-se de código oficial existente ou linha sem candidato. Não expõe informações de outro Cliente e não modifica reservas. Aplicação, concorrência e autenticação exigem testes antes da habilitação.
