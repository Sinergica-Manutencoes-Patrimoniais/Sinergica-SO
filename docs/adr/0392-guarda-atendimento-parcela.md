# ADR-0392 — Guarda transversal de atendimento de parcela

Prepara-se proteção opcional na transição de parcela para `atendida`: a revisão humana mais recente deve declarar condição atendida, referenciar a mesma OS atribuída e manter Cliente/Chamado compatíveis; a OS deve estar finalizada. A guarda protege também o comando legado, sem alterar outras operações ou histórico e sem transformar status da OS em prova suficiente.

O gate nasce desligado para preservar compatibilidade. Habilitação depende da disponibilidade do fluxo de revisão, análise de consumidores legados, testes de concorrência/autorizações e revisão adversarial. A declaração humana não comprova automaticamente autenticidade da evidência.
