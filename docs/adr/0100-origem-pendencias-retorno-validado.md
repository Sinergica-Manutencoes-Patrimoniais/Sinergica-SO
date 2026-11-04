# ADR-0100 — Origem comprovada de Pendências técnicas

## Estado

Proposta em análise, sem migration nem persistência. E01-S168 e a origem normalizada necessária ainda não estão implementadas; manter integração e homologação bloqueadas.

## Contexto

O importador preventivo legado preserva respostas e anexos como espelho do Auvo, não como validação PCM. A identidade da pergunta pode recorrer à descrição, e `reply` é texto livre; a lista recebida não prova todos os itens obrigatórios nem vínculo individual do alvo. Conclusão em campo, resumo `nao_ok` da ocorrência e texto do técnico não provam validação de execução, classificação por pergunta ou vínculo de ativo. Não converter esses dados diretamente em Pendência oficial nem criar Chamado/OS.

## Contrato proposto

E01-S168 deverá fornecer, no servidor e mediante contrato comprovado, uma decisão PCM imutável de validação, a versão do checklist efetivamente aplicado e respostas normalizadas explícitas, relacionadas à OS e Ocorrência canônicas, Cliente e alvo inequivocamente demonstrados. Verificar completude contra a versão integral do checklist, não contra apenas respostas recebidas. A ausência de identidade estável, versão, vínculo, resposta explícita ou evidência necessária deve manter o registro em conferência; não inferir valores ou localização a partir de prosa.

Para cada resposta explícita `nao_ok` não resolvida, a integração transacional poderá produzir uma Pendência atômica identificada por origem inequívoca de execução/pergunta/alvo, com referência à validação e versão efetivamente usadas. O servidor deriva Cliente, ator e direitos das entidades e da sessão; não confia no Cliente, estado ou conclusão enviados pelo navegador. Definir unicidade e correlação antes da migration, distinguindo reentrega da mesma fonte de nova execução. Alteração de resposta, correção posterior ou troca de versão preserva histórico e usa transição explícita, não sobrescreve resultado arbitrariamente.

`corrigido` deve preservar evidência sem abrir Pendência; `nao_aplicavel` mantém justificativa; ausência obrigatória impede validação. Conteúdo corrigido, fotos e medições permanecem vinculados à origem, com acesso controlado. A validação de preventiva com Não OK não encerra a necessidade corretiva nem gera automaticamente Chamado/OS. Não atribuir estado final à necessidade técnica a partir de categoria de texto livre.

A projeção local `preverPendenciasDeRetornoValidado` serve apenas para simulação com dados já normalizados; seu campo `estado` é fornecido pelo chamador e não comprova validação, integridade de Cliente ou completude do checklist. Não conectá-la a escrita, ao espelho legado ou a um evento Auvo até que o contrato servidor de E01-S168 forneça essas garantias. A projeção não é mecanismo de persistência nem de autorização.

## Gates de implementação

Antes de reservar migration: comprovar identidade estável e versão do checklist por execução, origem e escopo dos alvos, ordem de eventos, evidências e contrato real dos resultados. Se a fonte não oferece classificação explícita, criar fluxo de conferência PCM próprio como decisão arquitetural; não adivinhar. Projetar segurança por Cliente e ação, unicidade concorrente, requestId, revisão, rollback e auditoria append-only na mesma transação.

Testar dois Clientes e usuários autorizado/negado, revogação, reentrega idêntica, payload divergente, eventos fora de ordem, falha parcial, execução nova no mesmo alvo, alteração de versão, checklist incompleto, ausência de evidência, Não aplicável sem justificativa, Corrigido e Não OK. Garantir que reentrega e seleção parcial não criam Chamado, OS, intenção Auvo ou registros duplicados. Revisão adversarial, `db-tests` e CI são obrigatórios antes de PASS. Dados de produção e Auvo real não participam de fixtures.
