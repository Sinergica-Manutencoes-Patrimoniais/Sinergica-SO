# ADR-0957 — Recuperação por origem para estrutura XLSX

Status: preparação privada, sem habilitação.

Serializar recepção e consulta por Cliente e identificação de origem, independentemente da aba, pois a recepção legada usa origem sem distinguir aba. Uma origem já usada por outro pedido não cria novo recibo; o usuário deve recuperar a tentativa anterior. A consulta retorna somente ao ator original o requestId, digest, aba e resultado mínimo; conflitos com outro ator, outra aba, ou registros legados sem atestado retornam necessidade de reconciliação sem expor conteúdo. Nenhum arquivo original ou token é recuperado.

O protocolo não substitui conferência de armazenamento, proteção entre abas, tratamento de alterações posteriores em lotes/quarentenas ou política de retenção. Ordem de locks, concorrência de escritores legados, snapshots, RLS, autorização e privacidade devem ser provados antes de conceder EXECUTE. Gates fechados e sem operação real.
