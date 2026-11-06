# ADR-1062 — Acesso às superfícies preparadas

**Status:** preparado, não homologado. Complementa ADR-1051, 1052, 1053 e 1058.

Conceder EXECUTE ao papel autenticado exclusivamente para observação da fila, consulta de seu histórico e consultas da prévia de mudança contratual. As funções verificam sessão, ator, Cliente e capacidades; as tabelas permanecem privadas. Os gates já existentes continuam fechados e as telas dependem de flags desativadas. A concessão, sozinha, não ativa o fluxo.

Não conceder acesso a anon ou service_role nem abrir os gates nesta migration. A revisão de autorização, RLS/FORCE, revogação concorrente, troca de Cliente, replay, corrida na criação de ocorrência, ordem de locks e uso de dados legados precede qualquer habilitação ou deploy. As prévias não implementam a alteração de dia, e observação local não comprova efeito remoto.
