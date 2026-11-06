# ADR-0277 — Histórico de rateios da despesa

Status: proposta; função e gate fechados, sem testes.

O PCM autorizado consulta versões do rateio por Cliente, Visita e despesa; cada revisão inclui sua data, autor e parcelas, incluindo versão vazia quando houve remoção. Vínculo encerrado ou ausente é indicado, nunca ocultado ou tratado como vigente. Valores são retornados em centavos como texto para preservar precisão. Não altera a despesa nem produz lançamento financeiro. A função e a interface dependem de revisão de autorização, ordenação, concorrência e integração antes de ativação.
