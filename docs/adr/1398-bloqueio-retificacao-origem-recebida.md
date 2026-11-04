# ADR-1398 — Retificação de origem recebida ou processada

Uma indicação de Cliente não pode ser alterada após recepção do envelope em lote pendente ou processamento conhecido da mesma tarefa. O bloqueio protege os vínculos já registrados, inclusive se a escrita não vier da tela. Tentativas de concorrência recusam imediatamente a operação para nova conferência; nenhum dado histórico é apagado ou transferido.

Esta proteção não resolve automaticamente inconsistências antigas nem comprova que outras origens externas estejam cobertas. Aplicação e testes de concorrência, todas as entradas, RLS/FORCE, migrações e revisão adversarial são obrigatórios antes de liberar os fluxos.
