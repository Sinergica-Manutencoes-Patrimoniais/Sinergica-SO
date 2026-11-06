# ADR-0380 — Diagnóstico conservador de devolução parcial

A suspensão administrativa, atribuição de parcela a OS e declaração de interrupção são fatos separados; nenhum comprova, isoladamente, parada efetiva ou estado de execução. A especificação exige devolver apenas escopo não resolvido e não duplicar trabalho em curso. Prepara-se consulta privada paginada desses sinais, explicitamente sem elegibilidade nem devolução.

Não existe contrato canônico comprovado de reconciliação de trabalho interrompido por parcela. A devolução permanece bloqueada até prova adequada, tratamento concorrente e revisão adversarial; status da OS não é interpretado como prova de parada.
