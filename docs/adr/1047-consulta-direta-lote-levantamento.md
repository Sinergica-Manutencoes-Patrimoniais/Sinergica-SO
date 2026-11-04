# ADR-1047 — Abertura do lote recebido por identidade

**Status:** preparação privada, não homologada.

Permitir consultar metadados de um lote por Cliente e ID após recepção ou recuperação, sem percorrer páginas de outros lotes. A consulta exige identidade atual, capacidade `cadastro.gerir`, trava compartilhada de autorização e gate próprio desligado; ausência e acesso negado são indistinguíveis. A resposta contém somente campos da listagem existente, não conteúdo do levantamento nem aprovação. A interface usa flag desligada e revalida sessão antes e depois da leitura; mantém a lista anterior como alternativa.

Consulta direta não altera, aprova ou incorpora cadastros e não prova autenticidade da origem. Permanece privada até validar revogação concorrente, fontes de autorização e gate, isolamento, cache, troca de sessão, visibilidade dos dados e revisão adversarial. A leitura das linhas e comandos segue seus próprios controles e testes.
