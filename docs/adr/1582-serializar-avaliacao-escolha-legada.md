# ADR 1582 — Serializar avaliação da escolha legada

A avaliação deve adquirir uma trava compartilhada do Plano antes de selecionar a última escolha. Os comandos de decisão usam trava exclusiva da mesma linha. Isso impede avaliar uma decisão Visita substituída enquanto sua fotografia ainda parece igual. A trava usa NOWAIT e valida Cliente/revisão; não altera decisões, históricos ou a guarda 1045.
