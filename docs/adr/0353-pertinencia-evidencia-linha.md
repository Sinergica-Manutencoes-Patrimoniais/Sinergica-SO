# ADR-0353 — Revisão humana de pertinência de evidência

Prepara-se registro imutável de revisão humana `pertinente` ou `nao_pertinente` de foto/documento para a última edição conhecida da linha, com motivo, revisão do registro e idempotência. A revisão fica desatualizada se uma nova edição ocorrer. Nenhuma conclusão sobre autenticidade, data da evidência, segurança do arquivo ou publicação decorre dessa decisão.

O comando não altera aprovação de linha, anexo ou ativo. Gate e execução permanecem fechados. Testes de autorização, concorrência e comparação de revisões antecedem ativação.
