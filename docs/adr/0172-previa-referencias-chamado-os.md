# ADR-0172 — Prévia de referências Chamado/OS por Cliente

Status: proposta, não homologada.

Consulta paginada somente leitura classifica o campo singular legado contra o vínculo inverso da OS e conta OS já relacionadas por `chamado_id`. Apenas expõe ID da OS singular se pertence ao Cliente e não está excluída. Classifica divergências, referências ausentes, falta de vínculo inverso e referências repetidas como exigindo revisão; não altera vínculos nem infere associações por proximidade temporal. Exige superadmin ativo, `plano.gerir` do Cliente e gate fechado da prévia de migração; RPC revogada.

É uma prévia parcial de referências; repetição em outros Clientes não é verificada. Não é lote de migração, mapeamento aprovado, prova de integridade global ou liberação de piloto. Antes de executar migração faltam verificação de leitores e escritores, plano transacional e reversão lógica, proteção contra corridas e dados de outros domínios, testes e homologação.
