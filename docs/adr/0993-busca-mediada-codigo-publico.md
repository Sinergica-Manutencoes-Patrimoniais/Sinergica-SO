# ADR-0993 — Busca mediada de código público

Status: preparação privada, não homologada.

A busca exata por código atual ou alias deve conferir o ator esperado e autorização atual no Cliente após obter a trava compartilhada de autorização. Um gate próprio, fechado por padrão e travado até o fim da transação, controla a entrada volátil em READ COMMITTED. O núcleo de busca permanece inalterado para preservar resolução e ambiguidade de códigos legados, mas deixa de ser executável diretamente por papéis externos. A nova função nasce privada, sem concessão operacional; o cliente usa o contrato novo somente sob flag desligada.

Essa preparação exige rollout coordenado, pois a revogação impede o cliente antigo de chamar o núcleo. O protocolo de trava não garante cobertura de todos os escritores ou estabilidade dos ativos durante a leitura; testar isolamento por Cliente, colisões, aliases, troca e revogação de sessão, permissões, RLS/FORCE e concorrência antes de conceder execução. Nenhum código ou cadastro deve ser alterado pela busca.
