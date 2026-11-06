---
name: "docs-adr-0860-mediacao-staging-cronograma-md"
description: "Documento Sinérgica SO: ADR-0860 — Mediação de recepção e conferência do cronograma"
alwaysApply: false
---

# ADR-0860 — Mediação de recepção e conferência do cronograma

Status: implementação preparada; gates desligados e homologação pendente.

A recepção do cronograma S169 já grava no staging S178 (ADR-0136), preservando o staging anterior e sem criar estrutura oficial. Entretanto a tela chamava funções privadas, sem permissão de execução. Disponibilizamos quatro wrappers para recepção, listagem, detalhe e anotação no lote canônico; as funções originais permanecem privadas.

A mediação exige gate próprio e gate existente, identidade autenticada, autorização `plano.gerir`, READ COMMITTED e trava compartilhada de autorização para serializar revogações. Núcleo existente verifica conteúdo, Cliente, idempotência e revisão; anotações não aprovam nem incorporam linhas. Operações de classificação, mapeamento, aprovação e incorporação continuam fora desta mediação. Sem abertura de gate, migração em produção ou interação Auvo nesta etapa.

A listagem privada tinha referência ambígua a `id` (coluna retornada e coluna do gate); a migration qualifica a tabela sem alterar filtros nem autorização. A substituição valida a definição esperada e falha fechada se ela divergir.

Limites: conferir a compatibilidade com cadastro de concessões e operações de alteração de autorização em todas as rotas e revisar adversarialmente antes de habilitar. Dados do staging anterior permanecem intactos, mas não são automaticamente migrados.
