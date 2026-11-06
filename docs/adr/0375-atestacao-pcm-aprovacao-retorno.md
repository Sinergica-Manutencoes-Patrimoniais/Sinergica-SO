---
name: "docs-adr-0375-atestacao-pcm-aprovacao-retorno-md"
description: "Documento Sinérgica SO: ADR-0375 — Atestação PCM e decisão preparada do retorno"
alwaysApply: false
---

# ADR-0375 — Atestação PCM e decisão preparada do retorno

Status: proposta, não homologada.

Operador autorizado atesta explicitamente o retorno após revalidação transacional de respostas e requisitos de evidência congelados (0598). A decisão versionada canônica é executada com token transacional privado e cobertura estrutural temporária, preservando a guarda 0354/0582; em seguida a marca temporária é removida. O evento imutável documenta a atestação humana e não afirma autenticidade nem procedência Auvo do conteúdo. Não fecha OS ou Chamado e não dispara Auvo. Não OK gera pendências por 0584 na mesma transação.

O token evita que uma marca estrutural temporária seja usada por outra decisão; gate separado nasce fechado e o trigger não muda o legado enquanto desligado. Todas as operações são atômicas e falhas revertem a atestação. Política de evidência ainda não tipa conteúdo aceitável, e validação de autoria/integridade, reabertura, efeitos da aprovação, concorrência e semântica de cobertura requerem revisão adversarial e testes antes da ativação. O sistema não deve apresentar esta etapa como OS concluída.
