# ADR-0899 — Preservação de fórmulas compartilhadas

Data: 2026-10-30 · Status: preparação; importação XLSX permanece bloqueada.

A aba CRONOGRAMA da fonte I Home contém fórmulas compartilhadas. A recusa integral impede conferência da fonte, mas expandir fórmulas ou confiar no valor em cache poderia inventar dados.

Preservar o identificador de compartilhamento, referência declarada quando presente, expressão quando presente e valor em cache, sem cálculo, expansão ou conversão automática. Fórmulas de outros tipos e atributos desconhecidos seguem recusados. Consumidor futuro deve tratar qualquer fórmula como pendência explícita e não usar cache como verdade operacional. A seleção, conferência, limites de ZIP e revisão continuam obrigatórios antes de ativar XLSX.
