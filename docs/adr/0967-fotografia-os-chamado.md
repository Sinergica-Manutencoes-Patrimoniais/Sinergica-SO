# ADR-0967 — Fotografia paginada das OS do Chamado

Status: consulta privada preparada, não homologada.

Preparar leitura que calcula assinatura sobre vínculo legado e projeção integral das OS do mesmo Chamado, na mesma instrução que gera a página. A página seguinte apresenta a assinatura recebida; diferença recusa a continuação. A consulta preserva as guardas de Cliente e ambiguidades e limita o conjunto a 10.000 OS, falhando sem entregar página parcial quando houver inconsistência ou excesso. Gate e autorização do ADR-0966 permanecem obrigatórios; execução privada.

A assinatura não é autenticidade, não impede alterações revertidas entre páginas nem fixa snapshot ao longo de chamadas. A função percorre o conjunto completo por página e exige análise de volume, índices e limites de resposta. Validar consistência concorrente de vínculos/status, fontes de autorização, revogação, RLS, paginação, privacidade e revisão adversarial antes de integração ou concessão. Não libera múltiplas OS nem escrita.
