# ADR-0894 — Conferência semântica dos comandos legados

Data: 2026-10-30 · Status: preparação, gate fechado, não homologado.

O transporte do ADR-0893 pode aceitar comandos que mencionam o lote correto, mas não descrevem sua matriz, revisão ou anotação. Preparar mediação aditiva que, sob as mesmas travas e autorização, exige recepção original coerente e correspondência exata entre cada anotação e seu comando, sem alterar o histórico. Dados incoerentes são recusados integralmente para investigação, nunca corrigidos por inferência. Repetições de recepção válidas continuam permitidas.

A entrada anterior perde EXECUTE para usuários autenticados; banco e consumidor futuro precisam ser atualizados juntos. Em reversão, manter gate fechado e preservar registros. Antes da ativação, provar com dados representativos, concorrência, permissões e revisão adversarial.
