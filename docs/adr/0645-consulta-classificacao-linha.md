# ADR-0645 — Consulta de classificação do orçamento

Consulta por Cliente, proposta e versão retorna linhas do snapshot e respectivas classificações e revisões internas, limitada e paginada por identificador. Não modifica snapshot nem representa aceite do Cliente; permissão é verificada no servidor. A interface mantém pedidos idempotentes e gate desligado. Validar concessões, regras de acesso e concorrência antes de ativar.
