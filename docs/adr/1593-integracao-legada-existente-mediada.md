---
name: "docs-adr-1593-integracao-legada-existente-mediada-md"
description: "Documento Sinérgica SO: ADR 1593 — Integração mediada de ocorrência legada existente"
alwaysApply: false
---

# ADR 1593 — Integração mediada de ocorrência legada existente

O núcleo 0718 já permite vincular, por escolha humana, uma ocorrência legada existente e inerte ao ciclo SSO; não possui entrada autenticada. A materialização 0764 recusa vencidos, inclusive após decisão preliminar PCM. Expor o núcleo por mediador permite tratar vínculo já existente sem criar obrigação retroativa automática.

A entrada exige o protocolo 1643, Cliente e ator autenticados, concessão individual `plano.gerir`, gate de ponte mediada, gate de integração já existentes e reconfirma a autorização. O núcleo mantém verificação de relação positiva atual, alvo e data, inexistência de efeitos/OS e escolha explícita; o núcleo também bloqueia avaliações recebidas sob trava antes do vínculo, sem concluir equivalência geral; não cria OS nem Auvo. Nenhum gate é habilitado. A reversão revoga a RPC e preserva os vínculos auditados. Homologação depende de testes de concorrência, revogação, interface e CI.

A elegibilidade da fila também revalida avaliações recebidas sob trava: resultado ainda pendente com avaliação não é considerado Aguardando. O replay de integração existente mantém o recibo histórico e a autorização atual.

Se uma avaliação chega depois da inclusão, leituras da fila projetam Verificação sem alterar estado nem revisão registrados; a consulta v2 distingue essa situação e não oferece confirmação prematura. Criação nova de Chamado revalida a avaliação sob trava e falha fechada. Recibos e histórico anteriores permanecem; atualizações concorrentes são recusadas ou aguardam a transação.
