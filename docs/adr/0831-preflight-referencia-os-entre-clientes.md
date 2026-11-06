# ADR-0831 — Referência de OS compartilhada entre Clientes no preflight

Estado: proposta local; não aplicada nem homologada. Complementa ADR-0172 e ADR-0830.

A consulta de prévia 0398 classifica vínculos singulares para reconciliação, restrita a superadmin com `plano.gerir` no Cliente solicitado e protegida por gate desligado. Seu teste de referência compartilhada verificava apenas outros Chamados do mesmo Cliente. Se um Chamado de outro Cliente apontar à mesma OS, o Chamado consultado pode ser incorretamente classificado como `referencia_coerente`. A leitura 0312 já considera ambígua qualquer referência compartilhada entre Chamados ativos, independentemente do Cliente.

Decisão: ajustar somente o predicado da prévia para considerar referências ativas de outros Clientes. Retornar `referencia_compartilhada_revisar`, sem informar identidade, Cliente ou quantidade de outros Chamados. Não alterar vínculos, números, escrita, permissões nem gate. O resultado sinaliza revisão; não autoriza corrigir automaticamente a inconsistência. Demais critérios e prioridades permanecem os mesmos.

Teste em banco isolado usa fixtures sintéticas e uma cópia temporária do corpo da função com verificação do gate neutralizada exclusivamente na cópia, sem modificar o gate real. Esse teste não substitui CI, RLS, revisão adversarial ou validação operacional. Rollback funcional é substituir a função pelo corpo anterior em migração futura; isso volta a omitir o conflito entre Clientes e não altera dados. A correção não implementa criação 1:N nem libera a migração dos registros.
