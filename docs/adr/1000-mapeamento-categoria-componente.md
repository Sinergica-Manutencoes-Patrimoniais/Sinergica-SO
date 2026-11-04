# ADR-1000 — Categoria explícita de Componente

Status: preparação privada, não homologada.

O campo textual legado de categoria do Componente não é chave confiável da tabela de categorias. Preparar vínculo explícito por Componente e Cliente, com ID de categoria, texto observado, revisão, responsável, motivo e recibo idempotente. Alteração posterior do texto invalida a correspondência para consumidores; não alterar o texto legado nem executar sincronização automaticamente.

A confirmação exige gestão cadastral no Cliente, identidade e revisão; locks e gate protegem operação. O vínculo não prova que todas as classificações são corretas, nem habilita Equipment. As funções nascem privadas e gate fechado. Faltam consulta/interface, tratamento de transferência de Cliente e revisão em todos os escritores, integração da política à fila, RLS/FORCE, concorrência, auditoria e testes antes de habilitar.
