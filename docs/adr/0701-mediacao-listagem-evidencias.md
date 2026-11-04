# ADR-0701 — Mediação de listagens de evidências

As listagens de fotos e documentos e o resumo de fotos do levantamento recebem mediadores autenticados sob gate da ADR-0687 e autorização `cadastro.aprovar` no Cliente do lote. Os núcleos preservam seus gates, paginação e filtros. A mediação não fornece caminhos, URLs ou acesso ao conteúdo privado.

Ativação exige revisão de segurança e testes de isolamento, paginação e autorização de conteúdo em sua própria rota mediada.
