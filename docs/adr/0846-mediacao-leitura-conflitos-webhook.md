# ADR-0846 — Mediação de leitura de conflitos

Estado: proposta local; gates fechados, não homologada. Complementa ADR-0844.

A interface opt-in de 0844 não pode executar o núcleo privado da 1032 diretamente. Uma nova RPC de mediação, executável por `authenticated`, verifica um gate privado separado, exige READ COMMITTED e toma o lock compartilhado de autorização antes de chamar a consulta interna. O núcleo continua privado e valida o gate de reconciliação, usuário, ação, Cliente, OS e paginação. A autorização não depende da flag da interface. Gates iniciam fechados; nenhuma captura, resolução ou envio Auvo é habilitado.

A resposta mantém somente identificadores, status e datas. A interface usa o wrapper; erro ou autorização ausente ocultam os dados anteriores. Testes com cópias temporárias não substituem HTTP, duas sessões, CI nem revisão adversarial. Abrir qualquer gate depende de rollout e validação coordenados. Rollback operacional é desligar o gate da mediação; registros não são alterados.
