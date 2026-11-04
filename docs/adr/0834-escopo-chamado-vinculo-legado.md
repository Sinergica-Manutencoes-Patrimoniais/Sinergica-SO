# ADR-0834 — Leitura de escopo compatível com vínculo legado

Estado: proposta local, não homologada. Complementa ADR-0150 e ADR-0830; não habilita escrita 1:N.

A projeção de escopo 0376 lista apenas OS com `ordens_servico.chamado_id` direto. A leitura 0312 também reconhece a referência singular do Chamado quando a OS não possui vínculo inverso, desde que não haja divergência. Assim, a projeção podia declarar lista completa omitindo uma OS válida ou ignorando vínculo compartilhado. Teste em banco isolado reproduziu ambos os casos em cópia temporária, mantendo gate real fechado.

A projeção passa a validar as mesmas inconsistências de 0312 e incluir, sem duplicar, a OS singular unilateral válida; usa a mesma união para lista e indicador de truncamento. Cliente divergente, vínculo inverso divergente, referência ausente/excluída ou compartilhamento entre Chamados ativos provocam erro fechado. Não expõe dados de outro Cliente, não altera registros, ACL ou gate. A consulta permanece limitada a 100 itens de cada categoria e deve sinalizar resultado incompleto quando excede o limite.

O ajuste aproxima os consumidores da cardinalidade pretendida, mas não abre a criação múltipla, não cobre hipóteses de ponte secundária nem altera encerramento. Antes de ativar, são necessárias revisão adversarial, compatibilidade dos demais consumidores, testes de paginação/concorrência e CI. Rollback funcional requer migração posterior restaurando função anterior; não apaga dados, mas restabelece risco de omissão.
