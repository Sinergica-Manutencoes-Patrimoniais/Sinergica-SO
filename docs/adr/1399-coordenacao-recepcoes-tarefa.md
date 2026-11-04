# ADR-1399 — Coordenação entre envelopes da mesma tarefa

Recepção, processamento e retificação compartilham uma trava por tarefa Auvo, além da trava por envelope. Recepção e processamento recusam vínculo conhecido da mesma tarefa a outro Cliente em ambas as ordens; retificação recusa alteração quando qualquer envelope da mesma tarefa já foi recebido ou processado. Isso preserva os registros existentes e falha fechando diante de concorrência; não transfere ou corrige automaticamente históricos.

Antes de aplicar: validar inventário de escritores e vínculos, locks entre envelopes, RLS/FORCE, retentativas, desempenho, dados legados e revisão adversarial. Não comprova ausência de outras origens ou efeitos remotos.
